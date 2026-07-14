# Leo OS ASP.NET Core API — production image
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY LeoOs.sln ./
COPY LeoOs.Api/LeoOs.Api.csproj LeoOs.Api/
COPY LeoOs.Infrastructure/LeoOs.Infrastructure.csproj LeoOs.Infrastructure/
RUN dotnet restore LeoOs.Api/LeoOs.Api.csproj
COPY LeoOs.Api/ LeoOs.Api/
COPY LeoOs.Infrastructure/ LeoOs.Infrastructure/
RUN dotnet publish LeoOs.Api/LeoOs.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runner
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "LeoOs.Api.dll"]
