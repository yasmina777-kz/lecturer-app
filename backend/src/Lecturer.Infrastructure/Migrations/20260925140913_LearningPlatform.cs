using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lecturer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LearningPlatform : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarStyle",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "sage");

            migrationBuilder.AddColumn<bool>(
                name: "IsDisabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "SpeechRate",
                table: "Users",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "Questions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExercisesJson",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "{\"quiz\":[],\"tasks\":[]}");

            migrationBuilder.AddColumn<string>(
                name: "Introduction",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDemo",
                table: "Lectures",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPublished",
                table: "Lectures",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Level",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "Lectures",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceName",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Subject",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Summary",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Progress",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LectureId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlideIndex = table.Column<int>(type: "integer", nullable: false),
                    FurthestSlide = table.Column<int>(type: "integer", nullable: false),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    AnswersJson = table.Column<string>(type: "text", nullable: false),
                    QuizScore = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Progress", x => new { x.UserId, x.LectureId });
                    table.ForeignKey(
                        name: "FK_Progress_Lectures_LectureId",
                        column: x => x.LectureId,
                        principalTable: "Lectures",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Progress_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Progress_LectureId",
                table: "Progress",
                column: "LectureId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Progress");

            migrationBuilder.DropColumn(
                name: "AvatarStyle",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsDisabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SecurityStamp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SpeechRate",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "ExercisesJson",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "Introduction",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "IsDemo",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "IsPublished",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "SourceName",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "Subject",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "Summary",
                table: "Lectures");
        }
    }
}
