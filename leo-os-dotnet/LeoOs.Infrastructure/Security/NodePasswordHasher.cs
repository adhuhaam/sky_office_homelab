using System.Security.Cryptography;
using System.Text;
using CryptSharp.Core.Utility;

namespace LeoOs.Infrastructure.Security;

/// <summary>
/// Matches Node <c>crypto.scrypt</c> hashes stored as <c>saltHex:derivedHex</c>
/// (see leo-os/apps/api/src/lib/crypto.ts). Salt string is UTF-8 of the hex chars,
/// not the decoded bytes — same as Node when salt is a string.
/// </summary>
public static class NodePasswordHasher
{
    // Node crypto.scrypt defaults
    private const int Cost = 16384;
    private const int BlockSize = 8;
    private const int Parallel = 1;
    private const int DerivedLength = 64;

    public static string Hash(string password)
    {
        var salt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var derived = Derive(password, salt);
        return $"{salt}:{Convert.ToHexString(derived).ToLowerInvariant()}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split(':', 2);
        if (parts.Length != 2 || string.IsNullOrEmpty(parts[0]) || string.IsNullOrEmpty(parts[1]))
            return false;

        var salt = parts[0];
        byte[] expected;
        try
        {
            expected = Convert.FromHexString(parts[1]);
        }
        catch
        {
            return false;
        }

        var actual = Derive(password, salt);
        if (actual.Length != expected.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static byte[] Derive(string password, string saltString)
    {
        var key = Encoding.UTF8.GetBytes(password);
        var salt = Encoding.UTF8.GetBytes(saltString);
        return SCrypt.ComputeDerivedKey(key, salt, Cost, BlockSize, Parallel, null, DerivedLength);
    }
}
