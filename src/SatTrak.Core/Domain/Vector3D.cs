using System;

namespace SatTrak.Core.Domain;

/// <summary>
/// Represents a 3D vector using double-precision floating-point numbers.
/// Essential for physics calculations where standard float precision is insufficient.
/// </summary>
public readonly struct Vector3D
{
    public double X { get; }
    public double Y { get; }
    public double Z { get; }

    public Vector3D(double x, double y, double z)
    {
        X = x;
        Y = y;
        Z = z;
    }

    public override string ToString() => $"({X:F3}, {Y:F3}, {Z:F3})";
}
