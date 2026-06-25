using System;
using System.IO;

namespace McpRevit.Addin.Infrastructure;

internal sealed record McpEnvironmentStatus(
    string RevitMcpServerPath,
    bool RevitMcpServerExists,
    string BridgeEndpoint,
    string ConfigPath,
    bool ConfigExists);

internal static class McpEnvironment
{
    public const string DefaultRevitMcpServerPath =
        @"C:\Program Files\Autodesk\Revit 2027 MCP Server Technical Preview\RevitMCPServer.exe";

    public const string DefaultBridgeEndpoint = "http://127.0.0.1:17827";

    public static string ConfigDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "McpRevit");

    public static string ConfigPath => Path.Combine(ConfigDirectory, "mcp-revit.json");

    public static McpEnvironmentStatus GetStatus()
    {
        string bridgeEndpoint = Environment.GetEnvironmentVariable("MCP_REVIT_BRIDGE_URL") ?? DefaultBridgeEndpoint;

        return new McpEnvironmentStatus(
            DefaultRevitMcpServerPath,
            File.Exists(DefaultRevitMcpServerPath),
            bridgeEndpoint,
            ConfigPath,
            File.Exists(ConfigPath));
    }

    public static void EnsureConfig()
    {
        Directory.CreateDirectory(ConfigDirectory);

        if (File.Exists(ConfigPath))
        {
            return;
        }

        string json = """
        {
          "mcpServers": {
            "revit": {
              "command": "C:\\Program Files\\Autodesk\\Revit 2027 MCP Server Technical Preview\\RevitMCPServer.exe"
            }
          },
          "openai": {
            "model": "gpt-5.5",
            "fallbackModel": "gpt-5"
          },
          "bridge": {
            "endpoint": "http://127.0.0.1:17827"
          }
        }
        """;

        File.WriteAllText(ConfigPath, json);
    }
}
