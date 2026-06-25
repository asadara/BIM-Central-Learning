using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using McpRevit.Addin.Infrastructure;

namespace McpRevit.Addin.Ui;

internal sealed class McpPaneControl : UserControl
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(120) };

    private readonly TextBlock _serverStatus;
    private readonly TextBlock _bridgeStatus;
    private readonly TextBox _promptBox;
    private readonly TextBox _outputBox;

    public McpPaneControl()
    {
        var root = new DockPanel
        {
            Margin = new Thickness(12),
            LastChildFill = true
        };

        var header = new StackPanel
        {
            Orientation = Orientation.Vertical,
            Margin = new Thickness(0, 0, 0, 10)
        };

        header.Children.Add(new TextBlock
        {
            Text = "MCP Revit",
            FontSize = 18,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.Black
        });

        _serverStatus = new TextBlock { Margin = new Thickness(0, 8, 0, 0), TextWrapping = TextWrapping.Wrap };
        _bridgeStatus = new TextBlock { Margin = new Thickness(0, 4, 0, 0), TextWrapping = TextWrapping.Wrap };
        header.Children.Add(_serverStatus);
        header.Children.Add(_bridgeStatus);

        var buttonRow = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Margin = new Thickness(0, 10, 0, 0)
        };

        buttonRow.Children.Add(CreateButton("Refresh", (_, _) => RefreshStatus()));
        buttonRow.Children.Add(CreateButton("Health", async (_, _) => await CheckBridgeAsync()));
        buttonRow.Children.Add(CreateButton("Ask GPT", async (_, _) => await AskGptAsync()));
        buttonRow.Children.Add(CreateButton("Create Config", (_, _) => CreateConfig()));
        buttonRow.Children.Add(CreateButton("Open Config", (_, _) => OpenConfig()));
        header.Children.Add(buttonRow);

        DockPanel.SetDock(header, Dock.Top);
        root.Children.Add(header);

        var body = new Grid();
        body.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        body.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        _promptBox = new TextBox
        {
            MinHeight = 80,
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Text = "Ask GPT to inspect the active Revit model through MCP..."
        };
        Grid.SetRow(_promptBox, 0);
        body.Children.Add(_promptBox);

        _outputBox = new TextBox
        {
            Margin = new Thickness(0, 10, 0, 0),
            IsReadOnly = true,
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        Grid.SetRow(_outputBox, 1);
        body.Children.Add(_outputBox);

        root.Children.Add(body);
        Content = root;

        RefreshStatus();
    }

    private static Button CreateButton(string label, RoutedEventHandler handler)
    {
        var button = new Button
        {
            Content = label,
            MinWidth = 86,
            Margin = new Thickness(0, 0, 8, 0),
            Padding = new Thickness(8, 4, 8, 4)
        };
        button.Click += handler;
        return button;
    }

    private void RefreshStatus()
    {
        McpEnvironmentStatus status = McpEnvironment.GetStatus();
        _serverStatus.Text = status.RevitMcpServerExists
            ? $"Official Revit MCP Server: found\n{status.RevitMcpServerPath}"
            : $"Official Revit MCP Server: not found\nExpected: {status.RevitMcpServerPath}";

        _serverStatus.Foreground = status.RevitMcpServerExists ? Brushes.DarkGreen : Brushes.DarkRed;
        _bridgeStatus.Text = $"GPT bridge endpoint: {status.BridgeEndpoint}\nConfig: {status.ConfigPath}";
        _bridgeStatus.Foreground = status.ConfigExists ? Brushes.DarkGreen : Brushes.DarkOrange;
        _outputBox.Text = status.RevitMcpServerExists
            ? "Ready to connect an MCP-compatible GPT bridge."
            : "Install Autodesk Revit Public MCP Server add-on, then refresh this panel.";
    }

    private void CreateConfig()
    {
        try
        {
            McpEnvironment.EnsureConfig();
            RefreshStatus();
            _outputBox.Text = $"Config created:\n{McpEnvironment.ConfigPath}";
        }
        catch (Exception ex)
        {
            _outputBox.Text = ex.ToString();
        }
    }

    private void OpenConfig()
    {
        try
        {
            McpEnvironment.EnsureConfig();
            Process.Start(new ProcessStartInfo
            {
                FileName = McpEnvironment.ConfigPath,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            _outputBox.Text = ex.ToString();
        }
    }

    private async Task CheckBridgeAsync()
    {
        McpEnvironmentStatus status = McpEnvironment.GetStatus();
        try
        {
            string json = await Http.GetStringAsync($"{status.BridgeEndpoint.TrimEnd('/')}/health");
            _outputBox.Text = PrettyJson(json);
        }
        catch (Exception ex)
        {
            _outputBox.Text = $"Bridge health check failed:\n{ex.Message}\n\nExpected endpoint: {status.BridgeEndpoint}";
        }
    }

    private async Task AskGptAsync()
    {
        McpEnvironmentStatus status = McpEnvironment.GetStatus();
        try
        {
            string body = JsonSerializer.Serialize(new { prompt = _promptBox.Text });
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            using HttpResponseMessage response = await Http.PostAsync($"{status.BridgeEndpoint.TrimEnd('/')}/v1/chat", content);
            string responseBody = await response.Content.ReadAsStringAsync();
            _outputBox.Text = PrettyJson(responseBody);
        }
        catch (Exception ex)
        {
            _outputBox.Text = $"GPT bridge request failed:\n{ex.Message}\n\nExpected endpoint: {status.BridgeEndpoint}";
        }
    }

    private static string PrettyJson(string json)
    {
        try
        {
            using JsonDocument document = JsonDocument.Parse(json);
            return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions { WriteIndented = true });
        }
        catch
        {
            return json;
        }
    }
}
