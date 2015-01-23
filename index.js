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
    // Convert the GPX file to GeoJSON using toGeoJSON
    var geojson = gpx2geojson(dom);

    // get short segments with properties
    var segments = geojsonSegment(geojson);

    // prop up our initial map, using tiles from [Mapbox](https://www.mapbox.com/)
    var map = L.mapbox.map(d3.select(document.body)
        .append('div')
        .attr('id', 'map')
        .node(), 'tmcw.gp8115m8');

    var runLayer = L.mapbox.featureLayer(geojson).addTo(map);
    map.fitBounds(runLayer.getBounds());

    var props = geojson.features[0].properties,
        coords = geojson.features[0].geometry.coordinates,
        places = props.coordTimes.map(function(d, i) {
            return [new Date(d), coords[i]];
        }),
        bisectPlace = d3.bisector(function(d) { return d[0]; }).left,
        heartRates = coords.map(function(d, i) {
            return [props.coordTimes[i], d[2]];
        }),
        domain = d3.extent(places, function(m) { return m[0]; });

    var slider = chroniton()
      .domain(domain)
      .labelFormat(d3.time.format('%b %e'))
      .width(700);

    slider.on('change.place', function(d) {
      var datum = momentPlaces[bisectPlace(places, d)];
      hereMarker.setLatLng(L.latLng(datum[1][1], datum[1][0]));
    });

    // Elevation scale
    var margin = slider.getMargin();
    margin.bottom = 0;
    margin.top = 50;
    var height = 30;
    var width = slider.width();
    var x = slider.getScale();
    var y = d3.scale.linear().range([height, 0]);

    y.domain([0, d3.max(heartRates, function(d) { return d[1]; })]);

    var area = d3.svg.area()
        .x(function(d) { return x(d[0]); }).y0(height)
        .y1(function(d) { return y(d[1]); });

    var svg = d3.select('body').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    svg.append('path')
        .datum(heartRates)
        .attr('class', 'area')
        .attr('d', area);

    var label = svg.append('text').attr('text-anchor', 'middle');
    var connector = svg.append('rect').attr('width', 2);

    var bisect = d3.bisector(function(d) { return d[0]; }).left;
    slider.on('change.heart', function(d) {
      var datum = heartRates[bisect(heartRates, d)];
      label
        .attr('transform', 'translate(' + [x(d), -10] + ')')
        .text(datum[1].toFixed(3));
      connector
        .attr('transform', 'translate(' + [x(d) - 1, -5] + ')')
        .attr('height', y(datum[1]) + 3);
    });

    d3.select(document.body)
      .append('div')
      .call(slider);
});
