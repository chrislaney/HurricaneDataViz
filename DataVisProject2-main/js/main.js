let earthquakeData = []; // Store CSV data globally
let currentYear = 2024; // Default starting year
let leafletMap; // Placeholder for map instance
let timeline; // class holder for the timeline
const toggleBtn = document.getElementById("toggle-dragging");
let isBrushEnabled = false;

// Trying to increase performance by eliminating filtering by year.
// Seems like the main bottleneck is updating the map, which cant be helped.
let dataDictionary = {};

let timelineBrush = null;

let mapBrush = null;

let animationInterval;
let currentIndex = 0;
let isPlaying = false;
let animationSpeed = 100;

// Load earthquake data from CSV
Promise.all([
  d3.csv("data/2014-2025.csv"), // We will just use year 2013 to ref this full data since we arent using that year.
  d3.csv("data/2014.csv"),
  d3.csv("data/2015.csv"),
  d3.csv("data/2016.csv"),
  d3.csv("data/2017.csv"),
  d3.csv("data/2018.csv"),
  d3.csv("data/2019.csv"),
  d3.csv("data/2020.csv"),
  d3.csv("data/2021.csv"),
  d3.csv("data/2022.csv"),
  d3.csv("data/2023.csv"),
  d3.csv("data/2024.csv"),
  d3.csv("data/2025.csv"),
])
  .then((_data) => {
    var year = 2013;
    // Populate the data dictionary for faster loading/filtering
    _data.forEach((csv) => {
      // Convert values and check for missing magnitude
      csv.forEach((d) => {
        if (!d.mag) console.warn("Missing mag value for:", d);
        d.latitude = +d.latitude;
        d.longitude = +d.longitude;
        d.mag = +d.mag;
        d.depth = +d.depth;
        d.timestamp = new Date(d.time);
      });

      dataDictionary[year] = csv;
      year++;
    });

    let currData = dataDictionary[currentYear];

    timeline = new Timeline(
      {
        parentElement: "#timeline-container",
      },
      currData,
      new Date(`${currentYear}-01-01 00:00:00`),
      new Date(`${currentYear}-12-31 23:59:59`)
    );
    timeline.onEndBrush = handleTimelineBrush;

    // Initialize timeline and map
    updateVisualization();
  })
  .catch((error) => console.error(error));

// Function to update timeline and map based on the current year
function updateVisualization() {
  let currData = dataDictionary[currentYear];

  timeline.data = currData;
  timeline.startDate = new Date(`${currentYear}-01-01 00:00:00`);
  timeline.endDate = new Date(`${currentYear}-12-31 23:59:59`);
  timeline.updateVis();

  document.getElementById("year-label").textContent = currentYear;

  if (leafletMap) {
    leafletMap.updateData(currData); // Assuming `updateData` exists in your LeafletMap class
  } else {
    leafletMap = new LeafletMap({ parentElement: "#my-map" }, currData);
    leafletMap.onEndBrush = handleMapBrush;
    leafletMap.disableBrush();
  }
}

// Create navigation buttons
document.addEventListener("DOMContentLoaded", () => {
  const prevButton = document.getElementById("prev-year");
  const nextButton = document.getElementById("next-year");
  const yearLabel = document.getElementById("year-label");
  const playPauseButton = document.getElementById("play-pause-button");

  // Previous Year
  prevButton.addEventListener("click", () => {
    if (currentYear === 2014) {
      return;
    }
    currentYear--;
    timeline.startDate.setFullYear(timeline.startDate.getFullYear() - 1);
    timeline.endDate.setFullYear(timeline.endDate.getFullYear() - 1);
    applyFilters();
    yearLabel.textContent = currentYear;
  });

  // Next Year
  nextButton.addEventListener("click", () => {
    if (currentYear === 2025) {
      return;
    }
    currentYear++;
    timeline.startDate.setFullYear(timeline.startDate.getFullYear() + 1);
    timeline.endDate.setFullYear(timeline.endDate.getFullYear() + 1);
    applyFilters();
    yearLabel.textContent = currentYear;
  });

  // Animation Code
  document.getElementById("speed-up").addEventListener("click", () => {
    if (animationSpeed > 50) {
      // Prevents excessive fast-forwarding
      animationSpeed -= 50;
      updateAnimationSpeed();
    }
  });

  //Explain the reset button
  const resetText = document.createElement("span");
  resetText.id = "reset-text";
  resetText.textContent = "";
  yearLabel.style.fontSize = "16px";
  yearLabel.style.margin = "15px 15px 15px 15px";

  // Reset Button
  const resetButton = document.createElement("button");
  resetButton.textContent = "Reset Brush";
  resetButton.className = "button";
  resetButton.addEventListener("click", () => {
    timelineBrush = null;
    mapBrush = null;
    updateVisualization();
    applyFilters();
  });

  document.getElementById("nonmap-container").appendChild(resetText);
  document.getElementById("nonmap-container").appendChild(resetButton);

  document.getElementById("speed-back").addEventListener("click", () => {
    animationSpeed += 50;
    updateAnimationSpeed();
  });

  document.getElementById("stop-button").addEventListener("click", () => {
    clearInterval(animationInterval); // Stop the animation
    isPlaying = false;
    currentIndex = 0;
    updateVisualization();
    applyFilters();
    document.getElementById("play-pause-button").innerHTML =
      '<i class="fa fa-play fa-2x"></i>';
  });

  playPauseButton.addEventListener("click", () => {
    if (isPlaying) {
      clearInterval(animationInterval);
      isPlaying = false;
      playPauseButton.innerHTML = '<i class="fa fa-play fa-2x"></i>';
    } else {
      isPlaying = true;
      playPauseButton.innerHTML = '<i class="fa fa-pause fa-2x"></i>';
      startAnimation();
    }
  });

  function startAnimation() {
    if (isPlaying) {
      clearInterval(animationInterval); // Ensure no overlapping intervals
      animationInterval = setInterval(playNextFrame, animationSpeed);
    }
  }

  function playNextFrame() {
    let filteredData = dataDictionary[currentYear];

    filteredData = applyFilters();

    let currentDataSubset = filteredData.slice(0, currentIndex + 1);

    timeline.data = currentDataSubset;
    timeline.updateVis();
    leafletMap.updateData(currentDataSubset);

    currentIndex++;

    if (currentIndex >= filteredData.length) {
      clearInterval(animationInterval);
      isPlaying = false;
      playPauseButton.innerHTML = '<i class="fa fa-play fa-2x"></i>';
    }
  }

  function updateAnimationSpeed() {
    if (isPlaying) {
      clearInterval(animationInterval);
      animationInterval = setInterval(playNextFrame, animationSpeed);
    }
    document.querySelector(".animation_speed").textContent =
      animationSpeed + " ms";
  }
});


//LOGIC BELOW IS FOR FILTERING
document.getElementById("apply-filter").addEventListener("click", applyFilters);
document.getElementById("clear-filter").addEventListener("click", clearFilters);

function handleLegendClick(event) {
  const legendItem = event.target;
  const minMagnitude = parseFloat(legendItem.dataset.min);
  const maxMagnitude = parseFloat(legendItem.dataset.max);

  let filteredData = dataDictionary[currentYear];

  filteredData = filteredData.filter(
    (d) =>
      (isNaN(minMagnitude) || d.mag >= minMagnitude) &&
      (isNaN(maxMagnitude) || d.mag < maxMagnitude)
  );

  timeline.data = filteredData;
  timeline.updateVis();
  leafletMap.updateData(filteredData);
  return filteredData;
}

// Attach event listeners to legend items
document.addEventListener("DOMContentLoaded", function() {
  const legendItems = document.querySelectorAll(".legend-item");
  legendItems.forEach((item) => {
    item.addEventListener("click", handleLegendClick);
  });
});

function applyFilters() {
  let filteredData = dataDictionary[currentYear];

  if (document.getElementById("filter-depth").checked) {
    let minDepth = parseFloat(document.getElementById("min-depth").value);
    let maxDepth = parseFloat(document.getElementById("max-depth").value);
    filteredData = filteredData.filter(
      (d) =>
        (isNaN(minDepth) || d.depth >= minDepth) &&
        (isNaN(maxDepth) || d.depth <= maxDepth)
    );
  }

  if (document.getElementById("filter-magnitude").checked) {
    let minMagnitude = parseFloat(
      document.getElementById("min-magnitude").value
    );
    let maxMagnitude = parseFloat(
      document.getElementById("max-magnitude").value
    );
    filteredData = filteredData.filter(
      (d) =>
        (isNaN(minMagnitude) || d.mag >= minMagnitude) &&
        (isNaN(maxMagnitude) || d.mag <= maxMagnitude)
    );
  }


  if (timelineBrush !== null) {
    timeline.startDate = timelineBrush.startTime;
    timeline.endDate = timelineBrush.endTime;

    filteredData = filteredData.filter(
      (d) =>
        d.timestamp > timelineBrush.startTime &&
        d.timestamp < timelineBrush.endTime
    );
  }

  if (mapBrush !== null) {
    filteredData = filteredData.filter(
      (d) =>
        d.longitude > mapBrush.topLeft.lng &&
        d.longitude < mapBrush.bottomRight.lng &&
        d.latitude < mapBrush.topLeft.lat &&
        d.latitude > mapBrush.bottomRight.lat
    );
  }

  timeline.data = filteredData;
  timeline.updateVis();
  leafletMap.updateData(filteredData);
  return filteredData;
}

function clearFilters() {
  document.getElementById("filter-depth").checked = false;
  document.getElementById("filter-magnitude").checked = false;
  document.getElementById("min-depth").value = "";
  document.getElementById("max-depth").value = "";
  document.getElementById("min-magnitude").value = "";
  document.getElementById("max-magnitude").value = "";

  updateVisualization();
}

toggleBtn.addEventListener("click", function (event) {
  event.preventDefault();

  isBrushEnabled = !isBrushEnabled;

  if (isBrushEnabled) {
    toggleBtn.textContent = "Disable Map Brush";
    toggleBtn.classList.add("active");
    leafletMap.enableBrush();
    leafletMap.theMap.dragging.disable();
  } else {
    toggleBtn.textContent = "Enable Map Brush";
    toggleBtn.classList.remove("active");
    leafletMap.disableBrush();
    leafletMap.theMap.dragging.enable();
  }
});

let handleTimelineBrush = (event, vis) => {
  // Check if the brush is empty (no selection)
  if (!event.selection) {
    return;
  }

  var extent = event.selection;
  let selectedLines = vis.svg
    .selectAll(".quake-bar")
    .filter(
      (d) =>
        vis.xScale(d.timestamp) >= extent[0][0] &&
        vis.xScale(d.timestamp) <= extent[1][0]
    );
  let times = selectedLines.nodes().map((d) => d.getAttribute("data-time"));

  let startTime = new Date(d3.min(times));
  let endTime = new Date(d3.max(times));

  timelineBrush = {
    startTime: startTime,
    endTime: endTime,
  };

  // Clear the brush after processing
  vis.brushG.call(vis.brush.move, null);

  applyFilters();
};

let handleMapBrush = (event, vis) => {
  if (!event.selection) {
    return;
  }

  // Convert brush pixel coordinates to map coordinates
  const [x0, x1] = event.selection;
  const topLeft = vis.theMap.containerPointToLatLng([x0[0], x0[1]]);
  const bottomRight = vis.theMap.containerPointToLatLng([x1[0], x1[1]]);

  mapBrush = {
    topLeft: topLeft,
    bottomRight: bottomRight,
  };

  // Clear the brush after processing
  vis.brushG.call(vis.brush.move, null);

  applyFilters();
};
