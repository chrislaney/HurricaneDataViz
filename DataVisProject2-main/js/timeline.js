class Timeline {
    constructor(_config, _data, _startDate, _endDate) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1200,
            containerHeight: _config.containerHeight || 150,
            margin: _config.margin || {top: 1, right: 1, bottom: 1, left: 1},
            tooltipPadding: 10
        }

        this.data = _data;

        this.startDate = _startDate;
        this.endDate = _endDate;

        this.onEndBrush = () => {};

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner chart size
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;
        vis.timelineY = vis.height / 2;

        // Set timeline domain
        vis.xDomain = [vis.startDate, vis.endDate];

        // Create time scale
        vis.xScale = d3.scaleTime()
            .domain(vis.xDomain)
            .range([50, vis.width - 50]);

        // Create SVG container
        vis.svg = d3.select(vis.config.parentElement)
            .append("svg")
            .attr("width", vis.width)
            .attr("height", vis.height);

        // Magnitude scale (for bar height)
        vis.magScale = d3.scaleLinear()
            .domain([0, d3.max(vis.data, d => d.mag)])
            .range([5, vis.height]); // Ensures bars are tall enough

        vis.depthScale = d3.scaleLinear()
            .domain([0, d3.max(vis.data, d => d.depth)]) // Depth domain
            .range([0, 20]); // Controls bar length (adjust if needed)

        // Add Magnitude Label (above the axis)
        vis.svg.append("text")
            .attr("x", 70) // Position on the left
            .attr("y", vis.timelineY - 60) // Slightly above the timeline
            .attr("text-anchor", "end")
            .attr("font-size", "14px")
            .attr("fill", "black")
            .text("Magnitude");
    
        // Add Depth Label (below the axis)
        vis.svg.append("text")
            .attr("x", 50) // Align with Magnitude label
            .attr("y", vis.timelineY + 50) // Slightly below the timeline
            .attr("text-anchor", "end")
            .attr("font-size", "14px")
            .attr("fill", "black")
            .text("Depth");

        vis.xAxis = d3.axisBottom(vis.xScale).ticks(12).tickFormat(d3.timeFormat("%b"));
        vis.xAxisG = vis.svg.append("g");
    
        // Initialize brush component
        vis.brushG = vis.svg.append('g')
            .attr('class', 'brush x-brush');
    
        vis.brush = d3.brush()
            .extent([[0, 0], [vis.width, vis.height]])
            .on('end', (event) => {
                vis.onEndBrush(event, vis);
            });
    }

    updateVis() {
        let vis = this;

        // Reset the x scale
        vis.xDomain = [vis.startDate, vis.endDate];

        vis.xScale = d3.scaleTime()
            .domain(vis.xDomain)
            .range([50, vis.width - 50]);
        
        let tickNum = vis.endDate.getMonth() - vis.startDate.getMonth() + 1;
        vis.xAxis = d3.axisBottom(vis.xScale).ticks(tickNum).tickFormat(d3.timeFormat("%b"));

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        let quake_bars = vis.svg.selectAll(".quake-bar")
            .data(vis.data)
            .join('line');

        // Add bars (one per earthquake)
        quake_bars
            .attr("x1", d => vis.xScale(d.timestamp))
            .attr("x2", d => vis.xScale(d.timestamp))
            .attr("y1", vis.height - 60) // Start at baseline
            .attr("y2", d => vis.height - vis.magScale(d.mag)) // Scale height based on magnitude
            .attr("data-time", d => d.time)
            .attr("id", d => `quake-${d.timestamp.getTime()}`)
            .attr("stroke", d => getColor(d.mag)) // Use the same color function as dots
            .attr("stroke-width", 2.5)
            .attr("opacity", 0.7)
            .attr('class', 'quake-bar');

        let depth_bars = vis.svg.selectAll(".depth-bar")
            .data(vis.data)
            .join('line');

        // Add downward bars for depth
        depth_bars
            .attr("x1", d => vis.xScale(d.timestamp))
            .attr("x2", d => vis.xScale(d.timestamp))
            .attr("y1", vis.timelineY + 13) // Start slightly below timeline
            .attr("y2", d => vis.timelineY + 20 + vis.depthScale(d.depth)) // Extend downward
            .attr("stroke", "lightgray")
            .attr("stroke-width", 2)
            .attr("opacity", 0.6)
            .attr('class', 'depth-bar');

        // Call the xAxis
        vis.xAxisG.remove();
        vis.xAxisG = vis.svg.append("g")
            .attr("transform", `translate(0, ${vis.height - (vis.height/2)+12})`)
            .call(vis.xAxis);

        // Call brush
        vis.brushG.call(vis.brush);
    }
}

function getColor(mag) {
  if (mag < 3) return "blue";
  if (mag < 4) return "green";
  if (mag < 4.5) return "yellow";
  if (mag < 5) return "gold";
  if (mag < 5.5) return "orange";
  return "red";
}
