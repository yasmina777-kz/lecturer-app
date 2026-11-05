"""Technical subtitle/signing alignment audit, never automatic semantic approval.

Produces a local review queue and an offline video editor for an RSL annotator.
Tracking and motion can reject bad pairs; they cannot prove translation meaning.
"""
import argparse
import json
import os
from collections import Counter
from pathlib import Path

import numpy as np

from extract_subtitle_features import fingerprint
from prepare_youtube_corpus import digest
from subtitle_model import normalize_landmarks


def longest_missing(mask, period):
    longest = current = 0
    for present in mask:
        current = 0 if present else current+1
        longest = max(longest, current)
    return longest * period


def assess(rows, times, cue):
    start, end = cue['start'], cue['end']
    selected = (times >= start) & (times < end)
    clip, ts = rows[selected], times[selected]
    reasons, warnings = [], []
    if not 1 <= end-start <= 20:
        reasons.append('duration_outside_1_20_seconds')
    if len(clip) < 6:
        return dict(technicalEligible=False, reasons=reasons+['too_few_frames'], warnings=[], frames=len(clip))
    hands = np.any(clip[:, :126] != 0, axis=1)
    body = np.any(clip[:, 126:144] != 0, axis=1)
    face = np.any(clip[:, 144:] != 0, axis=1)
    period = float(np.median(np.diff(ts)))
    gap = longest_missing(hands, period)
    if hands.mean() < .35: reasons.append('hands_missing')
    if body.mean() < .5: reasons.append('body_missing')
    if face.mean() < .3: reasons.append('face_missing')
    if gap > 2: reasons.append('long_gap_without_hands')
    normalized = normalize_landmarks(clip).reshape(-1, 60, 3)
    visible = np.any(clip.reshape(-1, 60, 3) != 0, axis=-1)
    good = visible[1:, :42] & visible[:-1, :42]
    delta = np.linalg.norm(normalized[1:, :42] - normalized[:-1, :42], axis=-1)
    motion = (delta*good).sum(axis=1) / np.maximum(good.sum(axis=1), 1)
    if np.quantile(motion, .95) < .003:
        warnings.append('little_observed_hand_motion')
    # Relative motion at a subtitle edge only prioritizes review. It does not
    # invent a corrected sign boundary or infer that a moving hand is wrong.
    if len(motion) > 5:
        threshold = max(.015, float(np.quantile(motion, .75)))
        if max(motion[:2].mean(), motion[-2:].mean()) > threshold:
            warnings.append('movement_at_subtitle_boundary')
    return dict(technicalEligible=not reasons, reasons=reasons, warnings=warnings,
                frames=len(clip), hands=round(float(hands.mean()), 3),
                body=round(float(body.mean()), 3), face=round(float(face.mean()), 3),
                longestNoHandsSeconds=round(gap, 2),
                medianMotion=round(float(np.median(motion)), 5))


def validate_reviewed(rows, source_ids):
    """Validate explicit expert decisions; channel identity is not signer identity."""
    groups, accepted = {}, []
    for row in rows:
        if row.get('reviewStatus') != 'approved':
            continue
        if row.get('video_id') not in source_ids:
            raise ValueError('Unknown source')
        if not all(row.get(k) is True for k in ['meaningConfirmed', 'timingConfirmed']):
            raise ValueError('Meaning and timing must both be explicitly confirmed')
        if row.get('signLanguage') != 'rsl':
            raise ValueError('RSL language must be confirmed')
        if not row.get('reviewer', '').strip() or not row.get('signerGroup', '').strip():
            raise ValueError('Reviewer and signer group are required')
        start, end = row.get('correctedStart'), row.get('correctedEnd')
        if not isinstance(start, (int,float)) or not isinstance(end, (int,float)) or not 0 <= start < end <= row['sourceDuration']:
            raise ValueError('Corrected interval is outside the source')
        if not 1 <= end-start <= 20 or not row.get('correctedText', '').strip():
            raise ValueError('Invalid corrected translation or duration')
        split, group = row.get('split'), row['signerGroup']
        if split not in {'train','val','test'}:
            raise ValueError('Explicit split required')
        for key in [f'signer:{group}', f'recording:{row["recordingGroup"]}', f'source:{row["video_id"]}']:
            if key in groups and groups[key] != split:
                raise ValueError('Signer or recording leakage across splits')
            groups[key] = split
        accepted.append(row)
    return accepted


def build(audit_path, segments_path, features, catalog_path, output):
    audit = json.loads(audit_path.read_text())
    segments = json.loads(segments_path.read_text())
    catalog = json.loads(catalog_path.read_text())
    output.mkdir(parents=True, exist_ok=True)
    queue, per_source, reasons, warnings = [], [], Counter(), Counter()
    for source in audit['sources']:
        vid = source['video_id']
        note = catalog[vid]
        with np.load(features / f'{vid}.npz', allow_pickle=False) as data:
            if str(data['fingerprint']) != fingerprint(source):
                raise ValueError(f'Stale landmark cache: {vid}')
            rows, times = data['rows'], data['timestamps']
        cues = [c for c in segments if c['video_id'] == vid]
        items = []
        for i, cue in enumerate(cues):
            check = assess(rows, times, cue)
            if i and cue['start'] < cues[i-1]['end']:
                check['warnings'].append('overlapping_subtitles')
            reasons.update(check['reasons']); warnings.update(check['warnings'])
            item = dict(id=f'{vid}:{i}', video_id=vid, sourceDuration=source['duration'],
                        title=source['title'], sourceSha256=source['videoSha256'],
                        src=os.path.relpath(source['video'], output), start=cue['start'], end=cue['end'],
                        originalText=cue['translation'], correctedText=cue['translation'],
                        correctedStart=cue['start'], correctedEnd=cue['end'],
                        reviewStatus='pending', meaningConfirmed=False, timingConfirmed=False,
                        signLanguage=None, reviewer='', signerGroup='', split=None,
                        proposedSplit=note['proposedSplit'], recordingGroup=note['recordingGroup'],
                        technical=check)
            manual = next((r for r in note.get('technicalChecks', []) if r['segmentId'] == item['id']), None)
            if manual:
                item['technical']['manualCheck'] = manual
                item['note'] = manual['note']
                if manual['decision'] == 'exclude':
                    item['reviewStatus'] = 'rejected'
                    item['reviewer'] = 'assistant-technical-review-only'
                    item['technical']['technicalEligible'] = False
                    if 'manual_visual_exclusion' not in item['technical']['reasons']:
                        item['technical']['reasons'].append('manual_visual_exclusion')
                        reasons['manual_visual_exclusion'] += 1
            items.append(item)
        queue.extend(items)
        per_source.append(dict(video_id=vid, url=source['url'], title=source['title'],
                               videoSha256=source['videoSha256'], captionSha256=source['captionSha256'],
                               channel_id=source['channel_id'], duration=source['duration'],
                               segments=len(items), technicalEligible=sum(i['technical']['technicalEligible'] for i in items),
                               **note))
    summary = dict(downloadedVideos=len(audit['sources']), minutes=audit['downloadedMinutes'],
                   channels=len({s['channel_id'] for s in audit['sources']}),
                   subtitleSegments=len(queue), technicalEligible=sum(r['technical']['technicalEligible'] for r in queue),
                   technicalQuarantine=sum(not r['technical']['technicalEligible'] for r in queue),
                   invalidCaptionIntervals=audit.get('captionIssues', []),
                   quarantineReasons=dict(reasons), reviewWarnings=dict(warnings),
                   manualTechnicalChecks=sum(bool(r['technical'].get('manualCheck')) for r in queue),
                   manualExclusions=sum(r['reviewStatus'] == 'rejected' for r in queue),
                   semanticallyApproved=0, trainingReady=0,
                   note='Technical eligibility is not semantic alignment. Proposed splits require signer review.',
                   sourceAuditSha256=digest(audit_path), sourceCatalogSha256=digest(catalog_path), sources=per_source)
    (output/'review-queue.json').write_text(json.dumps(queue, ensure_ascii=False, indent=2))
    (output/'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    template = Path(__file__).with_name('subtitle-review-template.html').read_text()
    # Avoid HTML/script injection from externally authored subtitle strings.
    payload = json.dumps(queue, ensure_ascii=False).replace('<', '\\u003c')
    (output/'index.html').write_text(template.replace('__REVIEW_DATA__', payload))
    print(json.dumps({k:v for k,v in summary.items() if k not in ['sources','invalidCaptionIntervals']}, ensure_ascii=False, indent=2))
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit', type=Path, required=True)
    parser.add_argument('--segments', type=Path, required=True)
    parser.add_argument('--features', type=Path, required=True)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    build(args.audit, args.segments, args.features, args.catalog, args.output)
