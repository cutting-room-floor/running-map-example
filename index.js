// [toGeoJSON](https://github.com/mapbox/togeojson) transforms
// GPX files into [GeoJSON](http://geojson.org/),
// readable by [Mapbox.js](https://www.mapbox.com/mapbox.js/) and other
// open source tools.
var gpx2geojson = require('togeojson').gpx;

// geojson-segment transforms GeoJSON LineStrings with properties
// indicating other information like heart rate and time into
// line segments with simple before & after values.
var geojsonSegment = require('geojson-segment');

// [Chroniton](http://github.com/tmcw/chroniton) gives us a time slider for time-based data
var chroniton = require('chroniton');

// [d3](http://d3js.org/) draws the graphs that go alongside the map,
// for elevation and heart rate
var d3 = require('d3');

L.mapbox.accessToken = 'pk.eyJ1IjoidG1jdyIsImEiOiJIZmRUQjRBIn0.lRARalfaGHnPdRcc-7QZYQ';

// Load the GPX file with d3's xml method. This could also use [jQuery](http://jquery.com/)
// for AJAX or any other library that supports loading XML with XMLHttpRequest.
d3.xml('run.gpx', function(dom) {
    // # Data Conversion
    //
    // Convert the GPX file to GeoJSON using toGeoJSON
    var geojson = gpx2geojson(dom);

    // get short segments with properties
    var segments = geojsonSegment(geojson);

    // prop up our initial map, using tiles from [Mapbox](https://www.mapbox.com/)
    var map = L.mapbox.map(d3.select(document.body)
        .append('div')
        .attr('id', 'map')
        .node(), 'tmcw.l12c66f2');

    // Create shortcuts to properties and coordinates as `props` and
    // `coords`, and then resolve focused arrays of dates versus
    // places and heart rates
    var props = geojson.features[0].properties,
        coords = geojson.features[0].geometry.coordinates,
        // Create an array of `[date, position, heart rate]` that
        // we will use to power charts and interactions.
        datePlaceHeart = props.coordTimes.map(function(d, i) {
            return [new Date(d), coords[i], props.heartRates[i]];
        }),
        // Create a generalized getter creator: this is a function
        // that takes an key and returns a function that gets
        // that key from a given object.
        getter = function(n) { return function(_) { return _[n]; }; },
        getDate = getter(0),
        getHeart = getter(2),
        // Create a general scale that takes heart rate data. We'll use
        // this to derive colors for the map and positions for the line chart.
        heartRateScale = d3.scale.linear()
            .domain(d3.extent(datePlaceHeart, getHeart)),
        // Create a specific version of that scale that maps heart
        // rate to color
        heartRateColor = heartRateScale.copy()
            .range(['red', 'white'])
            .interpolate(d3.interpolateRgb),
        // Create a bisector function that helps us go from a place
        // on the chroniton slider to a place in time.
        bisectPlace = d3.bisector(function(d) { return d[0]; }).left,
        timeDomain = d3.extent(datePlaceHeart, getDate);

    // # Adding Map Layers
    //
    // First: add a white casing layer that surrounds the path and makes
    // it easier to differntiate from the surrounding map
    var casingLayer = L.geoJson(geojson, {
        style: function() { return { weight: 9, color: '#fff', opacity: 1 }; }
    }).addTo(map);

    // And then add the run layer. This is a layer of short LineString
    // segments, and we color each one its own special hue by using the
    // `heartRateColor` scale we created before.
    var runLayer = L.geoJson(segments, {
        style: function(feature) {
            return {
                weight: feature.geometry.coordinates[0][2] / 7,
                opacity: 1,
                color: heartRateColor(feature.properties.heartRates[0])
            };
        }
    }).addTo(map);

    // A marker that follows the runner's position when the time changes
    var hereMarker = L.circleMarker(L.latLng(0, 0), {
        color: 'darkred', weight: 1, opacity: 1,
        fillColor: 'red', fillOpacity: 1, radius: 5
    }).addTo(map);

    map.fitBounds(runLayer.getBounds());

    // # The Slider
    //
    // Here we use [chroniton](http://github.com/tmcw/chroniton) to navigate
    // through time.
    var slider = chroniton()
      .domain(timeDomain)
      // A custom label format shows time elapsed since the beginning of the
      // run (`timeDomain[0]`) rather than absolute time.
      .labelFormat(function(d) {
          return d3.time.format('%M:%S')(new Date(+d - timeDomain[0]));
      })
      .width(700);

    // When the slider moves, use d3.bisect to find the right place
    // for the map's location indicator to move as well.
    slider.on('change.place', function(d) {
          var datum = datePlaceHeart[bisectPlace(datePlaceHeart, d)];
          hereMarker.setLatLng(L.latLng(datum[1][1], datum[1][0]));
    });

    // # Elevation scale
    var margin = slider.getMargin();
    margin.bottom = 0;
    margin.top = 20;

    // Use the slider's width, scale, and margins to position the
    // line and area graphs for heart rate and elevation in the right position
    // and sync them to user input.
    var height = 80;
    var width = slider.width();
    var x = slider.getScale();
    var heart = heartRateScale.copy()
        .range([height, 0]);
    var elevation = d3.scale.linear()
        .range([height, 0])
        .domain([0, d3.max(datePlaceHeart, function(d) {
            return d[1][2];
        })]);

    // Create a line generator for heart rate and an area generator
    // for elevation. They're very similar, only the y-getter function
    // varies.
    var heartLine = d3.svg.line()
        .x(function(d) { return x(d[0]); })
        .y(function(d) { return heart(d[2]); });

    var elevationLine = d3.svg.area()
        .x(function(d) { return x(d[0]); })
        .y0(height)
        .y1(function(d) { return elevation(d[1][2]); });

    // Create the SVG element and group within it where the charts will live.
    var svg = d3.select('body').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('class', 'chart')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Append the paths for the elevation and area charts, within the
    // same element, as well as the label and connector that displays
    // the current heart rate
    svg.append('path')
        .datum(datePlaceHeart)
        .attr('class', 'elevation-area')
        .attr('d', elevationLine);

    svg.append('path')
        .datum(datePlaceHeart)
        .attr('class', 'heart-line')
        .attr('d', heartLine);

    var label = svg.append('text')
        .attr('text-anchor', 'middle');

    var connector = svg.append('rect')
        .attr('width', 1)
        .attr('class', 'heart-indicator')
        .attr('height', height);

    // Hove the label and indicator line on the charts whenever
    // the slider moves.
    slider.on('change.heart', function(d) {
        var datum = datePlaceHeart[bisectPlace(datePlaceHeart, d)];
        label
            .attr('transform', 'translate(' + [x(d), -5] + ')')
            .text(getHeart(datum) + ' bpm');
        connector
            .attr('transform', 'translate(' + [x(d) - 1, 0] + ')');
    });

    // Append the slider element to the page.
    d3.select(document.body)
        .append('div')
        .call(slider);
});
