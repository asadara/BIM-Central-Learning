using System;
using System.IO;
using Autodesk.Revit.UI;
using McpRevit.Addin.Commands;
using McpRevit.Addin.Infrastructure;
using McpRevit.Addin.Ui;

namespace McpRevit.Addin;

public sealed class App : IExternalApplication
{
    private const string PanelName = "MCP Revit";

    public Result OnStartup(UIControlledApplication application)
    {
        try
        {
            Log.Info("MCP Revit startup.");
            RegisterDockablePane(application);
            CreateRibbon(application);
            return Result.Succeeded;
        }
        catch (Exception ex)
        {
            Log.Error("Startup failed.", ex);
            TaskDialog.Show("MCP Revit", $"Startup failed:\n{ex.Message}");
            return Result.Failed;
        }
    }

    public Result OnShutdown(UIControlledApplication application)
    {
        Log.Info("MCP Revit shutdown.");
        return Result.Succeeded;
    }

    private static void RegisterDockablePane(UIControlledApplication application)
    {
        application.RegisterDockablePane(
            PaneIds.McpAssistantPane,
            "MCP Assistant",
            new McpPaneProvider());
    }

    private static void CreateRibbon(UIControlledApplication application)
    {
        RibbonPanel panel = application.CreateRibbonPanel(PanelName);
        string assemblyPath = typeof(App).Assembly.Location;

        var openPanelButton = new PushButtonData(
            "McpRevitOpenPanel",
            "Open\nMCP",
            assemblyPath,
            typeof(OpenPanelCommand).FullName);

        if (panel.AddItem(openPanelButton) is PushButton button)
        {
            button.ToolTip = "Open the MCP Revit assistant panel.";
            button.LongDescription = "Opens a dockable panel prepared for Autodesk Revit Public MCP Server and GPT bridge workflows.";
        }
    }
}
