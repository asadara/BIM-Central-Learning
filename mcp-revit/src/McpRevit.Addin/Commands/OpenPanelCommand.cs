using System;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using McpRevit.Addin.Infrastructure;
using McpRevit.Addin.Ui;

namespace McpRevit.Addin.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class OpenPanelCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        try
        {
            DockablePane pane = commandData.Application.GetDockablePane(PaneIds.McpAssistantPane);
            pane.Show();
            return Result.Succeeded;
        }
        catch (Exception ex)
        {
            Log.Error("Open panel failed.", ex);
            message = ex.Message;
            return Result.Failed;
        }
    }
}
