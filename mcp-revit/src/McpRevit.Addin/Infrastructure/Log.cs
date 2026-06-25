using System;
using System.IO;

namespace McpRevit.Addin.Infrastructure;

internal static class Log
{
    private static readonly string LogDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "McpRevit",
        "logs");

    private static readonly string LogPath = Path.Combine(LogDirectory, "mcp-revit-addin.log");

    public static void Info(string message) => Write("INFO", message, null);

    public static void Error(string message, Exception exception) => Write("ERROR", message, exception);

    private static void Write(string level, string message, Exception? exception)
    {
        try
        {
            Directory.CreateDirectory(LogDirectory);
            string line = $"{DateTimeOffset.Now:O} [{level}] {message}";
            if (exception is not null)
            {
                line += Environment.NewLine + exception;
            }

            File.AppendAllText(LogPath, line + Environment.NewLine);
        }
        catch
        {
            // Logging must never break Revit startup.
        }
    }
}
