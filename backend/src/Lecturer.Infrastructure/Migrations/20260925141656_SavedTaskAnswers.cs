using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lecturer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SavedTaskAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TaskAnswersJson",
                table: "Progress",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TaskAnswersJson",
                table: "Progress");
        }
    }
}
