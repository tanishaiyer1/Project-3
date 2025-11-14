const width = 900, height = 450, rectsize = 7;
const mapDiv = d3.select("#map");

const canvas = mapDiv.append("canvas")
  .attr("width", width)
  .attr("height", height)
  .style("display", "block")
  .node();
const ctx = canvas.getContext("2d");

const overlaySvg = mapDiv.append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("position", "absolute")
  .style("left", 0)
  .style("top", 0)
  .style("top", 0)
  // .style("pointer-events", "none");
  .style("pointer-events", "auto");

// Tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("background", "rgba(0, 0, 0, 0.8)")
  .style("color", "white")
  .style("padding", "8px 12px")
  .style("border-radius", "4px")
  .style("font-size", "12px")
  .style("pointer-events", "none")
  .style("opacity", 0)
  .style("z-index", 1000);

// Trend chart container
const trendDiv = d3.select("#container").append("div")
  .attr("id", "trend-chart")
  .style("margin-top", "20px")
  .style("display", "none");

const projection = d3.geoEquirectangular().fitSize([width, height], { type: "Sphere" });
const geoPath = d3.geoPath().projection(projection);

// Helper function to normalize longitude from 0-360 to -180-180
function normalizeLongitude(lon) {
  if (lon > 180) return lon - 360;
  return lon;
}

// Helper function to determine continent from coordinates
function getContinentFromCoords(lon, lat) {
  lon = normalizeLongitude(lon);
  // Antarctica 
  if (lat < -60) {
    // Check: if it's in the New Zealand region, it's not Antarctica
    if (lon >= 165 && lon <= 180 && lat >= -50 && lat <= -34) return "Australia/Oceania";
    // South America's southern tip is around lat -55, so check that too
    if (lon >= -70 && lon <= -55 && lat >= -60 && lat <= -50) return "South America";
    return "Antarctica";
  }
  
  // South America
  if (lon >= -85 && lon <= -35 && lat >= -55 && lat <= 15) return "South America";
  
  // Australia/Oceania - includes New Zealand (lon 165-180, lat -47 to -34)
  if (lon >= 110 && lon <= 180 && lat >= -50 && lat <= 0) return "Australia/Oceania";
  
  // Africa
  if (lon >= -20 && lon <= 50 && lat >= -35 && lat <= 37) return "Africa";
  
  // North America
  if (lon >= -180 && lon <= -10 && lat >= 10 && lat <= 90) return "North America";
  
  // Europe 
  if (lon >= -10 && lon <= 40 && lat >= 35 && lat <= 75) {
    // Exclude eastern Russia (if lon > 30 and lat > 60, it's likely Asian Russia)
    if (lon > 30 && lat > 60) return "Asia";
    return "Europe";
  }
  
  // Asia 
  if (lon >= 40 && lon <= 180 && lat >= 10 && lat <= 90) return "Asia";
  
  // Arctic 
  if (lat > 75) return "Arctic";
  
  return "Other";
}

Promise.all([
  d3.csv("grid_temp_decades.csv"),
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
]).then(([data, world]) => {
  data.forEach(d => {
    d.lat = +d.lat;
    d.lon = +d.lon;
    if (d.lon > 180) d.lon = d.lon - 360;
    d.year = +d.year;
    d.temp = +d.temp;
    d.scenario = d.scenario;
  });

  // Focus color on realistic surface temp range
  const colorMin = -25, colorMax = 35;
  const color = d3.scaleSequential(d3.interpolateRdYlBu)
    .domain([colorMax, colorMin]); // Red = hot, blue = cold

  // Country borders - make clickable
  const countries = topojson.feature(world, world.objects.countries);
  // const countryPaths = overlaySvg.append("g")
  //   .attr("class", "countries")
  //   .style("pointer-events", "auto")
  //   .selectAll("path")
  //   .data(countries.features)
  //   .join("path")
  //   .attr("d", geoPath)
  //   .attr("fill", "rgba(255,255,255,0.01)")
  //   .attr("stroke", "black")
  //   .attr("stroke-width", 1.2)
  //   .attr("opacity", 0.98)
  //   .style("cursor", "pointer")
  //   .style("pointer-events", "visibleStroke");
  const countryPaths = overlaySvg.append("g")
    .attr("class", "countries")
    .selectAll("path")
    .data(countries.features)
    .join("path")
    .attr("d", geoPath)
    .attr("fill", "rgba(255,255,255,0.01)") // nearly transparent
    .attr("stroke", "black")
    .attr("stroke-width", 1.2)
    .style("cursor", "pointer")
    .style("pointer-events", "all") // enable clicks and hover on shape
    .on("click", function(event, d) {
      event.stopPropagation();
      const centroid = geoPath.centroid(d);
      const [lon, lat] = projection.invert(centroid);
      const continent = getContinentFromCoords(lon, lat);
      showTrendChart(continent, data);
  });



  // Year dropdown
  const yearSet = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);

  let currentFilteredData = [];

  function draw(scenario, year) {
    ctx.clearRect(0, 0, width, height);
    currentFilteredData = data.filter(d => d.scenario === scenario && d.year === +year);
    currentFilteredData.forEach(d => {
      const [x, y] = projection([d.lon, d.lat]);
      ctx.fillStyle = color(d.temp);
      ctx.fillRect(x, y, rectsize, rectsize);
    });
  }

  // Tooltip on mouse move over canvas
  // d3.select(canvas).on("mousemove", function(event) {
  //   console.log("mousemove firing");
  //   const rect = canvas.getBoundingClientRect();
  //   const mx = event.clientX - rect.left;
  //   const my = event.clientY - rect.top;
    
  //   // Find nearest data point
  //   let nearest = null;
  //   let minDist = Infinity;
    
  //   currentFilteredData.forEach(d => {
  //     const [px, py] = projection([d.lon, d.lat]);
  //     const dist = Math.sqrt(Math.pow(mx - px, 2) + Math.pow(my - py, 2));
  //     if (dist < minDist && dist < rectsize * 3) {
  //       minDist = dist;
  //       nearest = d;
  //     }
  //   });
    
  //   if (nearest) {
  //     tooltip
  //       .style("opacity", 1)
  //       .html(`Temperature: ${nearest.temp.toFixed(2)}°C<br>Lat: ${nearest.lat.toFixed(2)}°, Lon: ${nearest.lon.toFixed(2)}°`)
  //       .style("left", (event.pageX + 10) + "px")
  //       .style("top", (event.pageY - 10) + "px");
  //   } else {
  //     tooltip.style("opacity", 0);
  //   }
  // });
  overlaySvg.on("mousemove", function(event) {
    const [mx, my] = d3.pointer(event); // relative to SVG

    let nearest = null;
    let minDist = Infinity;

    currentFilteredData.forEach(d => {
      const [px, py] = projection([d.lon, d.lat]);
      const dist = Math.sqrt(Math.pow(mx - px, 2) + Math.pow(my - py, 2));
      if (dist < minDist && dist < rectsize * 3) {
        minDist = dist;
        nearest = d;
      }
    });

    if (nearest) {
      tooltip
        .style("opacity", 1)
        .html(`Temperature: ${nearest.temp.toFixed(2)}°C<br>Lat: ${nearest.lat.toFixed(2)}°, Lon: ${nearest.lon.toFixed(2)}°`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    } else {
      tooltip.style("opacity", 0);
    }
  });

  overlaySvg.on("mouseleave", () => tooltip.style("opacity", 0));

  // Click handler for continents (on country paths)
  countryPaths.on("click", function(event, d) {
    event.stopPropagation();
    // Get the centroid of the clicked country
    const centroid = d3.geoPath().projection(projection).centroid(d);
    const [lon, lat] = projection.invert(centroid);
    const continent = getContinentFromCoords(lon, lat);
    
    showTrendChart(continent, data);
  });

  // Fallback: click on canvas to determine continent
  d3.select(canvas).on("click", function(event) {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const [lon, lat] = projection.invert([mx, my]);
    const continent = getContinentFromCoords(lon, lat);
    
    showTrendChart(continent, data);
  });

  // Function to show temperature trend for a continent
  function showTrendChart(continent, allData) {
    // Filter data by continent based on coordinates
    const continentData = allData.filter(d => {
      const cont = getContinentFromCoords(d.lon, d.lat);
      return cont === continent;
    });

    // Group by year and scenario, calculate mean temperature
    const trendData = {};
    continentData.forEach(d => {
      const key = `${d.year}-${d.scenario}`;
      if (!trendData[key]) {
        trendData[key] = { year: d.year, scenario: d.scenario, temps: [] };
      }
      trendData[key].temps.push(d.temp);
    });

    const trends = Object.values(trendData).map(d => ({
      year: d.year,
      scenario: d.scenario,
      meanTemp: d3.mean(d.temps)
    }));

    // Clear previous chart
    trendDiv.selectAll("*").remove();
    trendDiv.style("display", "block");

    // Title
    trendDiv.append("h3")
      .style("text-align", "center")
      .style("margin-bottom", "10px")
      .text(`Temperature Trend: ${continent}`);

    const margin = { top: 20, right: 80, bottom: 40, left: 60 };
    const chartWidth = 800 - margin.left - margin.right;
    const chartHeight = 300 - margin.top - margin.bottom;

    const svg = trendDiv.append("svg")
      .attr("width", chartWidth + margin.left + margin.right)
      .attr("height", chartHeight + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(trends, d => d.year))
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(trends, d => d.meanTemp)).nice()
      .range([chartHeight, 0]);

    // Color scale for scenarios
    const scenarioColor = d3.scaleOrdinal()
      .domain(["Low Emissions", "Medium Emissions", "High Emissions"])
      .range(["#2ecc71", "#f39c12", "#e74c3c"]);

    // Line generator
    const line = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.meanTemp))
      .curve(d3.curveMonotoneX);

    // Group by scenario
    const scenarios = ["Low Emissions", "Medium Emissions", "High Emissions"];
    scenarios.forEach(scenario => {
      const scenarioTrends = trends.filter(d => d.scenario === scenario)
        .sort((a, b) => a.year - b.year);

      g.append("path")
        .datum(scenarioTrends)
        .attr("fill", "none")
        .attr("stroke", scenarioColor(scenario))
        .attr("stroke-width", 2)
        .attr("d", line);

      g.selectAll(`.dot-${scenario.replace(/\s+/g, "-")}`)
        .data(scenarioTrends)
        .enter().append("circle")
        .attr("class", `dot-${scenario.replace(/\s+/g, "-")}`)
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.meanTemp))
        .attr("r", 4)
        .attr("fill", scenarioColor(scenario));
    });

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
      .append("text")
      .attr("x", chartWidth / 2)
      .attr("y", 35)
      .attr("fill", "#333")
      .style("text-anchor", "middle")
      .text("Year");

    g.append("g")
      .call(d3.axisLeft(yScale).tickFormat(d => `${d.toFixed(1)}°C`))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -chartHeight / 2)
      .attr("fill", "#333")
      .style("text-anchor", "middle")
      .text("Mean Temperature (°C)");

    // Legend - positioned in upper left
    const legend = g.append("g")
      .attr("transform", "translate(10, 10)");

    scenarios.forEach((scenario, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`);

      legendRow.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("stroke", scenarioColor(scenario))
        .attr("stroke-width", 2);

      legendRow.append("text")
        .attr("x", 25)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(scenario);
    });
  }

  let currentScenario = d3.select("#scenario").property("value");
  let currentYear = yearSet[0];
  d3.select("#yearSelect").property("value", currentYear);
  draw(currentScenario, currentYear);

  //Year slider setup
  const yearSlider = d3.select("#yearSlider");
  const yearValue = d3.select("#yearValue");

  //Initialize slider min/max value based on available years
  yearSlider
    .attr("min", d3.min(yearSet))
    .attr("max", d3.max(yearSet))
    .attr("step", 10)
    .property("value", currentYear);

  yearValue.text(currentYear);

  //When the user drags the slider
  yearSlider.on("input", function () {
    currentYear = +this.value;
    yearValue.text(currentYear);
    draw(currentScenario, currentYear);
  });

  d3.select("#scenario").on("change", function () {
    currentScenario = this.value;
    draw(currentScenario, currentYear);
  });

  // ---- Horizontal legend below map ----
  const legendWidth = 320, legendHeight = 16;
  const legendSvg = d3.select("#legend-holder")
    .append("svg")
    .attr("width", legendWidth + 44)
    .attr("height", legendHeight + 40);

  // Gradient for legend
  const defs = legendSvg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%").attr("x2", "100%")
    .attr("y1", "0%").attr("y2", "0%");
  Array.from({ length: 12 }, (_, i) => i / 11).forEach(t => {
    const temp = colorMin + t * (colorMax - colorMin);
    gradient.append("stop")
        .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(temp));
});


  legendSvg.append("rect")
    .attr("x", 22)
    .attr("y", 10)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#legend-gradient)")
    .attr("stroke", "black")
    .attr("stroke-width", 0.7);

  const legendScale = d3.scaleLinear()
    .domain([colorMin, colorMax])
    .range([0, legendWidth]);

  const legendAxis = d3.axisBottom(legendScale)
    .ticks(6)
    .tickFormat(d => `${d.toFixed(1)}°C`);
  legendSvg.append("g")
    .attr("transform", `translate(22, ${legendHeight + 10})`)
    .call(legendAxis);

  legendSvg.append("text")
    .attr("x", legendWidth / 2 + 22)
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("fill", "#333")
    .text("Mean Temperature (°C)");
});
