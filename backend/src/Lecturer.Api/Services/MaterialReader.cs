using System.IO.Compression;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using UglyToad.PdfPig;
namespace Lecturer.Api.Services;
public static class MaterialReader
{
    public static async Task<string> Read(IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0 || file.Length > 10 * 1024 * 1024) throw new ServiceException(400, "Файл должен быть непустым и не больше 10 МБ.");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, ct); buffer.Position = 0;
        string text;
        try
        {
            if (ext is ".txt" or ".md") text = new UTF8Encoding(false, true).GetString(buffer.ToArray());
            else if (ext == ".pdf")
            {
                using var pdf = PdfDocument.Open(buffer.ToArray());
                if (pdf.NumberOfPages > 100) throw new ServiceException(400, "Поддерживается до 100 страниц.");
                var content = new StringBuilder();
                foreach (var page in pdf.GetPages()) { ct.ThrowIfCancellationRequested(); content.AppendLine(page.Text); if (content.Length > 60000) break; }
                text = content.ToString();
            }
            else if (ext is ".docx" or ".pptx")
            {
                using var zip = new ZipArchive(buffer, ZipArchiveMode.Read);
                if (zip.Entries.Count > 3000 || zip.Entries.Sum(e => e.Length) > 50_000_000) throw new ServiceException(400, "Слишком большой распакованный документ.");
                var entries = zip.Entries.Where(e => ext == ".docx" ? e.FullName == "word/document.xml" : System.Text.RegularExpressions.Regex.IsMatch(e.FullName, @"^ppt/slides/slide\d+\.xml$"))
                    .OrderBy(e => ext == ".pptx" ? int.Parse(System.Text.RegularExpressions.Regex.Match(e.FullName, @"\d+").Value) : 0);
                var content = new StringBuilder();
                foreach (var entry in entries)
                {
                    using var stream = entry.Open();
                    using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 5_000_000 });
                    var doc = XDocument.Load(reader);
                    content.AppendLine(string.Join(" ", doc.Descendants().Where(e => e.Name.LocalName == "t").Select(e => e.Value)));
                    if (content.Length > 60000) break;
                }
                text = content.ToString();
            }
            else throw new ServiceException(400, "Поддерживаются PDF, DOCX, PPTX, TXT и MD.");
        }
        catch (ServiceException) { throw; }
        catch (OperationCanceledException) { throw; }
        catch { throw new ServiceException(400, "Не удалось прочитать файл. Проверьте формат и отсутствие пароля."); }
        if (text.Trim().Length < 40) throw new ServiceException(400, "В документе мало текста. Для сканов PDF сначала нужно распознать текст (OCR).");
        if (text.Length > 60000) throw new ServiceException(400, "Материал превышает 60 000 символов. Разделите его на части.");
        return text;
    }
}
