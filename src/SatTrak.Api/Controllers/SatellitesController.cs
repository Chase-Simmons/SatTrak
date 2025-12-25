using Microsoft.AspNetCore.Mvc;
using SatTrak.Core.Services;

namespace SatTrak.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SatellitesController : ControllerBase
{
    private readonly ITleCache _tleCache;

    public SatellitesController(ITleCache tleCache)
    {
        _tleCache = tleCache;
    }

    [HttpGet]
    public IActionResult GetAll()
    {
        try 
        {
            var tles = _tleCache.GetAll();
            if (tles == null) return StatusCode(500, "Cache returned null");

            var dtos = tles.Select(t => new SatelliteTleDto
            {
                Id = (int)t.NoradNumber,
                Name = t.Name?.Trim() ?? "Unknown",
                Line1 = t.Line1 ?? "",
                Line2 = t.Line2 ?? ""
            });

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            return StatusCode(500, ex.ToString());
        }
    }
}

public class SatelliteTleDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Line1 { get; set; }
    public string Line2 { get; set; }
}
