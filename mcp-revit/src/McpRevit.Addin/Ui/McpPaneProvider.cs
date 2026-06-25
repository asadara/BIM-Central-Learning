using Autodesk.Revit.UI;

namespace McpRevit.Addin.Ui;

internal sealed class McpPaneProvider : IDockablePaneProvider
{
    public void SetupDockablePane(DockablePaneProviderData data)
    {
        data.FrameworkElement = new McpPaneControl();
        data.InitialState = new DockablePaneState
        {
            DockPosition = DockPosition.Right
        };
    }
}
