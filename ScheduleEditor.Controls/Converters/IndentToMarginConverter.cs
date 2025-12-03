using System;
using System.Globalization;
using System.Windows.Data;

namespace ScheduleEditor.Controls.Converters;

/// <summary>
/// Converts IndentLevel to Margin for DockPanel, combining base 6px left margin with indent padding.
/// </summary>
public class IndentToMarginConverter : IValueConverter
{
    private const double BaseLeftMargin = 6.0;
    private const double IndentSize = 16.0;

    public object Convert(object? value, Type targetType, object parameter, CultureInfo culture)
    {
        var indentLevel = value switch
        {
            int i => i,
            double d => (int)d,
            _ => 0
        };

        var leftMargin = BaseLeftMargin + (indentLevel * IndentSize);
        return new Thickness(leftMargin, 12, 0, 0);
    }

    public object ConvertBack(object? value, Type targetType, object parameter, CultureInfo culture)
    {
        return Binding.DoNothing;
    }
}

