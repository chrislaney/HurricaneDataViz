let apikey = "d8eb308191df42d3add88b975fe90ff6";

class LeafletMap {
  /**
   * Class constructor with basic configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
    };
    this.data = _data;
    this.onEndBrush = () => {};
    this.canBrush = false;
    this.initVis();
  }

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    //ESRI
    vis.esriUrl =
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    vis.esriAttr =
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

    //TOPO
    vis.topoUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
    vis.topoAttr =
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';

    //Thunderforest Outdoors-
    vis.thOutUrl = `https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${apikey}`;
    vis.thOutAttr =
      '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    //Stamen Terrain
    vis.stUrl =
      "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}";
    vis.stAttr =
      'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    //this is the base map layer, where we are showing the map background
    vis.base_layer = L.tileLayer(vis.esriUrl, {
      id: "esri-image",
      attribution: vis.esriAttr,
      ext: "png",
    });

    vis.theMap = L.map("my-map", {
      center: [30, 0],
      zoom: 2,
      layers: [vis.base_layer],
    });

    //if you stopped here, you would just have a map

    //initialize svg for d3 to add to map
    L.svg({ clickable: true }).addTo(vis.theMap); // we have to make the svg layer clickable
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane);
    vis.svg = vis.overlay.select("svg").attr("pointer-events", "auto");

    //these are the city locations, displayed as a set of dots
    vis.Dots = vis.svg
      .selectAll("circle")
      .data(vis.data)
      .join("circle")
      .attr("data-time", d => d.time)
      .attr("fill", (d) => getColor(d.mag))
      .attr("stroke", "black")
      //Leaflet has to take control of projecting points.
      //Here we are feeding the latitude and longitude coordinates to
      //leaflet so that it can project them on the coordinates of the view.
      //the returned conversion produces an x and y point.
      //We have to select the the desired one using .x or .y
      .attr(
        "cx",
        (d) => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x
      )
      .attr(
        "cy",
        (d) => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y
      )
      .attr("r", (d) => 3)
      .style("opacity", 0.4) // --- TO DO- want to make radius proportional to earthquake size?
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .style("opacity", 0.5)
          .duration("150")
          .attr("r", 1.96 ** +d.mag);
      
        let quakeId = `quake-${new Date(d.time).getTime()}`;
        d3.select(`#${quakeId}`)
          .transition()
          .duration(150)
          .attr("stroke", "blue")
          .attr("stroke-width", 10);
      
        showFormattedTooltip(d, event);
      })
      
      .on("mousemove", (event) => {
        //position the tooltip
        d3.select("#tooltip")
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseleave", function (event, d) {
         //function to add mouseover event
        d3.select(this)
          .transition() //D3 selects the object we have moused over in order to perform operations on it
          .duration("150") //how long we are transitioning between the two states (works like keyframes)
          //.attr("fill", "steelblue") //change the fill  TO DO- change fill again
          .attr("r", 3); //change radius
      
        if (!d.time) return;

        let timeValue = new Date(d.time);
        if (isNaN(timeValue)) return;

        let quakeId = `quake-${timeValue.getTime()}`;
        d3.select(`#${quakeId}`)
          .transition()
          .duration(150)
          .attr("stroke", getColor(d.mag))
          .attr("stroke-width", 2.5);
      
          const formattedTime = d3.timeFormat("%B %d, %Y %I:%M %p")(timeValue);
          const formattedMag = d3.format(".2f")(d.mag);
          const formattedDepth = d3.format(",")(d.depth);
          
          d3.select("#tooltip")
            .style("opacity", 0.95)
            .style("z-index", 1000000)
            .html(`
              <div style="font-weight: bold; margin-bottom: 5px;">Earthquake Details</div>
              <div><strong>Time:</strong> ${formattedTime}</div>
              <div><strong>Magnitude:</strong> ${formattedMag}</div>
              <div><strong>Depth:</strong> ${formattedDepth} km</div>
            `);
      });

    //handler here for updating the map, as you zoom in and out
    vis.theMap.on("zoomend", function () {
      vis.updateVis();
    });

    // Add event listener to the dropdown menu
    document
      .getElementById("map-style-select")
      .addEventListener("change", function () {
        const selectedStyle = this.value;
        vis.updateMapLayer(selectedStyle);
      });

    // Initialize brush component
    vis.brushG = vis.svg.append('g')
      .attr('class', 'brush brush');

    vis.brush = d3.brush()
      .extent([[0, 0], [vis.theMap.getSize().x, vis.theMap.getSize().y]])
      .on('end', (event) => {
          vis.onEndBrush(event, vis);
      });

    // Call brush
    if (vis.canBrush)
      vis.brushG.call(vis.brush);
  }

  updateMapLayer(style) {
    let vis = this;

    // Remove current base layer
    vis.theMap.removeLayer(vis.base_layer);

    // Set new base layer based on selected style
    switch (style) {
      case "Esri.WorldImagery":
        vis.base_layer = L.tileLayer(vis.esriUrl, {
          id: "esri-image",
          attribution: vis.esriAttr,
          ext: "png",
        });
        break;
      case "OpenTopoMap":
        vis.base_layer = L.tileLayer(vis.topoUrl, {
          attribution: vis.topoAttr,
          ext: "png",
        });
        break;
      case "Thunderforest.Outdoors":
        vis.base_layer = L.tileLayer(vis.thOutUrl, {
          attribution: vis.thOutAttr,
          ext: "png",
        });
        break;
      case "Stamen.Terrain":
        vis.base_layer = L.tileLayer(vis.stUrl, {
          attribution: vis.stAttr,
          ext: "png",
        });
        break;
      default:
        vis.base_layer = L.tileLayer(vis.esriUrl, {
          id: "esri-image",
          attribution: vis.esriAttr,
          ext: "png",
        });
        break;
    }

    // Add the new base layer to the map
    vis.base_layer.addTo(vis.theMap);
  }

  updateVis() {
    let vis = this;

    //want to see how zoomed in you are?
    // console.log(vis.map.getZoom()); //how zoomed am I?
    //----- maybe you want to use the zoom level as a basis for changing the size of the points... ?

    //redraw based on new zoom- need to recalculate on-screen position
    vis.Dots.attr(
      "cx",
      (d) => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x
    )
      .attr(
        "cy",
        (d) => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y
      )
      .attr("fill", (d) => getColor(d.mag)) //---- TO DO- color by magnitude
      .attr("r", 3);

    vis.resetBrush();

    if (vis.canBrush)
      vis.brushG.call(vis.brush);
  }

  renderVis() {
    let vis = this;

    //not using right now...
  }

  updateData(filteredData) {
    let vis = this;

    // Update the class property to store the new filtered data
    vis.data = filteredData;

    // Remove old points (clears the previous year’s markers)
    vis.Dots.remove();

    // Bind new data and redraw points
    vis.Dots = vis.svg
      .selectAll("circle")
      .data(vis.data)
      .join("circle")
      .attr("data-time", d => d.time)
      .attr("fill", (d) => getColor(d.mag))
      .attr("stroke", "black")
      .attr(
        "cx",
        (d) => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x
      )
      .attr(
        "cy",
        (d) => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y
      )
      .attr("r", (d) => 3)
      .style("opacity", 0.4)
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .style("opacity", 0.5)
          .duration("150")
          .attr("r", 1.96 ** +d.mag);
      
        let quakeId = `quake-${new Date(d.time).getTime()}`;
        d3.select(`#${quakeId}`)
          .transition()
          .duration(150)
          .attr("stroke", "blue")
          .attr("stroke-width", 10);
      
        showFormattedTooltip(d, event);
      })
      
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseleave", function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", 3);
      
        let quakeId = `quake-${new Date(d.time).getTime()}`;
        d3.select(`#${quakeId}`)
          .transition()
          .duration(150)
          .attr("stroke", getColor(d.mag))
          .attr("stroke-width", 2.5);
      
        d3.select("#tooltip")
          .style("opacity", 0)
          .style("z-index", -1);
      });

    // Ensure dots update their position when zooming
    vis.theMap.on("zoomend", function () {
      vis.updateVis();
    });

    vis.updateVis();
  }

  enableBrush() {
    let vis = this;
    vis.brushG.call(vis.brush);
    vis.canBrush = true;
  }

  disableBrush() {
    let vis = this;
    vis.brushG.on('.brush', null);

    vis.canBrush = false;
  }

  resetBrush() {
    let vis = this;

    vis.brushG.remove();
    vis.brushG = vis.svg.append('g')
      .attr('class', 'brush brush');

    vis.brush = d3.brush()
      .extent([[0, 0], [vis.theMap.getSize().x, vis.theMap.getSize().y]])
      .on('end', (event) => {
          vis.onEndBrush(event, vis);
      });
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

function showFormattedTooltip(d, event) {
  const timeValue = new Date(d.time);
  const formattedTime = d3.timeFormat("%B %d, %Y %I:%M %p")(timeValue);
  const formattedMag = d3.format(".2f")(d.mag);
  const formattedDepth = d3.format(",")(d.depth);

  d3.select("#tooltip")
    .style("opacity", 0.95)
    .style("z-index", 1000000)
    .html(`
      <div style="font-weight: bold; margin-bottom: 5px;">Earthquake Details</div>
      <div><span style="font-weight: bold;">Time:</span> <span style="font-weight: normal;">${formattedTime}</span></div>
      <div><span style="font-weight: bold;">Magnitude:</span> <span style="font-weight: normal;">${formattedMag}</span></div>
      <div><span style="font-weight: bold;">Depth:</span> <span style="font-weight: normal;">${formattedDepth} km</span></div>
    `)
    .style("left", event.pageX + 10 + "px")
    .style("top", event.pageY + 10 + "px");
}




