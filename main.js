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
  .style("top", 0);

const projection = d3.geoEquirectangular().fitSize([width, height], { type: "Sphere" });
const geoPath = d3.geoPath().projection(projection);

Promise.all([
  d3.csv("grid_temp_decades.csv"),
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
]).then(([data, world]) => {
  data.forEach(d => {
    d.lat = +d.lat;
    d.lon = +d.lon;
    d.year = +d.year;
    d.temp = +d.temp;
    d.scenario = d.scenario;
  });

  // Focus color on realistic surface temp range
  const colorMin = -25, colorMax = 35;
  const color = d3.scaleSequential(d3.interpolateRdYlBu)
    .domain([colorMax, colorMin]); // Red = hot, blue = cold

  // Country borders
  const countries = topojson.feature(world, world.objects.countries);
  overlaySvg.append("g")
    .selectAll("path").data(countries.features)
    .join("path")
    .attr("d", geoPath)
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 1.2)
    .attr("opacity", 0.98);

  // Year dropdown
  const yearSet = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);
  const yearSelect = d3.select("#yearSelect");
  yearSet.forEach(y => {
    yearSelect.append("option")
      .attr("value", y)
      .text(y);
  });

  function draw(scenario, year) {
    ctx.clearRect(0, 0, width, height);
    const filtered = data.filter(d => d.scenario === scenario && d.year === +year);
    filtered.forEach(d => {
      const [x, y] = projection([d.lon, d.lat]);
      ctx.fillStyle = color(d.temp);
      ctx.fillRect(x, y, rectsize, rectsize);
    });
  }

  let currentScenario = d3.select("#scenario").property("value");
  let currentYear = +d3.select("#yearSelect").property("value") || yearSet[0];
  d3.select("#yearSelect").property("value", currentYear);
  draw(currentScenario, currentYear);

  d3.select("#scenario").on("change", function () {
    currentScenario = this.value;
    draw(currentScenario, currentYear);
  });

  d3.select("#yearSelect").on("change", function () {
    currentYear = +this.value;
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
    const temp = colorMax - t * (colorMax - colorMin);
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
    .attr("y", 36)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("fill", "#333")
    .text("Mean Temperature (°C)");
});
