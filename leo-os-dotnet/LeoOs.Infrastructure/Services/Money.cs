namespace LeoOs.Infrastructure.Services;

public static class Money
{
    public static string? NormalizeMoney(object? input, int scale = 2, int maxIntegerDigits = 12)
    {
        if (input is null) return null;
        var raw = input.ToString()?.Trim() ?? "";
        if (raw.Length == 0) return null;
        if (!decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var n))
            return null;
        var s = n.ToString($"F{scale}", System.Globalization.CultureInfo.InvariantCulture);
        var intPart = s.Split('.')[0].TrimStart('-');
        if (intPart.Length > maxIntegerDigits) return null;
        return s;
    }

    public static string? NormalizeDate(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var t = input.Trim();
        if (t is "0000-00-00" or "0") return null;
        if (DateOnly.TryParse(t, out var d))
            return d.ToString("yyyy-MM-dd");
        return "invalid";
    }

    public static int SalaryDays(int? daysWorked) =>
        daysWorked is null or < 0 ? 0 : daysWorked.Value;

    public static string ComputeEmployeeNet(
        decimal basicSalary,
        decimal foodAllowance,
        decimal transportAllowance,
        decimal otherAllowances,
        decimal deductions,
        decimal otherExpenses,
        int? daysWorked)
    {
        var days = SalaryDays(daysWorked);
        var net = basicSalary * days + foodAllowance + transportAllowance + otherAllowances + otherExpenses - deductions;
        return net.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
    }

    public static string ComputeClientBillTotal(decimal clientSalary, int? daysWorked)
    {
        var days = SalaryDays(daysWorked);
        return (clientSalary * days).ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
    }

    public static string ComputeLineAmount(decimal qty, decimal rate) =>
        (qty * rate).ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
}

public static class EmergencyContact
{
    public static string? Format(string? name, string? phone)
    {
        var n = name?.Trim();
        var p = phone?.Trim();
        if (!string.IsNullOrEmpty(n) && !string.IsNullOrEmpty(p)) return $"{n}, {p}";
        if (!string.IsNullOrEmpty(n)) return n;
        if (!string.IsNullOrEmpty(p)) return p;
        return null;
    }
}
