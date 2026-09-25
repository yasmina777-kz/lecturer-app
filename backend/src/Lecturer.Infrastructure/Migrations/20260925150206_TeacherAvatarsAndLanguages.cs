using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lecturer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TeacherAvatarsAndLanguages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarId",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "classic-male");

            migrationBuilder.AddColumn<string>(
                name: "InterfaceLanguage",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "ru");

            migrationBuilder.AddColumn<string>(
                name: "TeachingLanguage",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "ru");

            migrationBuilder.AddColumn<string>(
                name: "VoiceGender",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "male");

            migrationBuilder.AddColumn<string>(
                name: "AvatarId",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "classic-male");

            migrationBuilder.AddColumn<string>(
                name: "AvatarStyle",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "sage");

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "ru");

            migrationBuilder.AddColumn<string>(
                name: "VoiceGender",
                table: "Lectures",
                type: "text",
                nullable: false,
                defaultValue: "male");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "InterfaceLanguage",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TeachingLanguage",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "VoiceGender",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AvatarId",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "AvatarStyle",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "Lectures");

            migrationBuilder.DropColumn(
                name: "VoiceGender",
                table: "Lectures");
        }
    }
}
