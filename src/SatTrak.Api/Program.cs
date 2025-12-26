using SatTrak.Api.Hubs;
using SatTrak.Api.Workers;
using SatTrak.Core.Services;
using SatTrak.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddSingleton<ITleCache, CommandLineTleCache>();
builder.Services.AddTransient<IPropagatorService, PropagatorService>();
builder.Services.AddHttpClient<ITleFetcherService, TleFetcherService>();
builder.Services.AddHostedService<TleWorker>();
builder.Services.AddHostedService<BroadcastWorker>();
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");
app.UseAuthorization();

app.MapControllers();
app.MapHub<SatelliteHub>("/satelliteHub");

app.Run();
