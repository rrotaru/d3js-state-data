var jsondata = {};
var jsonarray = [];
var map;
$.getJSON('json/stateaverages.json', function(dataset) {
    var data = dataset.data;

    var columns = dataset.meta.view.columns;
    var nameField = 8; // Index of the name field in the state data object
    var colorkey = ['lowest', 'very low', 'low', 'medium low', 'medium', 'medium high', 'high', 'very high', 'highest']

        // Format json data into the way we want it
        for (var i = 0; i < data.length; i++) {
            var stateName = data[i][nameField];

            jsondata[stateName] = {};
            for (var j = 0; j < data[i].length; j++) {
                var fieldName = columns[j].fieldName;
                var fieldText = columns[j].name;
                var fieldType = columns[j].dataTypeName;
                if (fieldType !== "meta_data" && fieldType !== "text" && fieldType !== 'calendar_date') {
                    jsondata[stateName][fieldName] = {name: fieldText, type: fieldType, value: data[i][j] ? data[i][j] : 0};
                }
            }
        }

    // Format colors for json data
    var i, j = 0;
    for (i = 0; i < data[j].length; i++) {
        var max = 0, min = Infinity;

        for (j = j; j < data.length ; j++) {
            var val = parseFloat(data[j][i]);
            if (max < val) max = val;
            if (min > val) min = val;
        }
        var diff = max - min;
        var step = diff / 8.0; // 5 colors for the heatmap
        j = 0;

        for (k = 0; k < data.length; k++) {
            var stateName = data[k][nameField];        
            var fieldName = columns[i].fieldName;
            var fieldType = columns[i].dataTypeName;
            if (fieldType !== "meta_data" && fieldType !== "text" && fieldType !== 'calendar_date') {           

                var stepval = Math.ceil(parseInt((data[k][i] - min)*1000 )/ (step*1000));
                jsondata[stateName][fieldName].fillKey = colorkey[stepval];
                if (i === 9) {
                    jsondata[stateName].fillKey = colorkey[stepval];
                }
            }
        }
    }

    delete jsondata["PR"];
    delete jsondata["GU"];
    delete jsondata["VI"];
    jsonarray = Object.keys(jsondata).map(function(k) { 
        jsondata[k].label = k; 
        return jsondata[k];
    })
    jsonarray.shift();

    function updateData() {
        selectVal = this.value;
        for (var key in jsondata) {
            jsondata[key].fillKey = jsondata[key][this.value].fillKey;
        }
        map.updateChoropleth(jsondata);

        $("#chart svg g *").remove();
        $("#bar svg g *").remove();
        createBar(jsonarray);
        createPie(jsonarray);

    };

    /*** 
     *** D3JS Choropleth Heat Map
     ***/
    var sel = $('<select>').prependTo('#controller').css({'float':'right'});
    var desc = $('<div>').appendTo('#controller').css({'position':'absolute','bottom':'8px'});
    desc.append($('<h1>').text(dataset.meta.view.name).css({'font-family':'sans-serif'}));
    desc.append($('<p>').text(dataset.meta.view.description).css({'font-family':'sans-serif','font-size':'14px'}));
    sel.change(updateData);

    for (var key in jsondata['NATION']) {
        if (key !== 'fillKey' && key !== 'label')
        sel.append($("<option>").attr('value',key).text(jsondata['NATION'][key].name));
    }
    selectVal = $('select').val();

    map = new Datamap({
        scope: 'usa',
        element: document.getElementById('container'),
        fills: {
            'lowest' : 'hsl(240, 100%, 50%)',
            'very low' : 'hsl(210, 100%, 50%)',
            'low' : 'hsl(180, 100%, 50%)',
                'medium low' : 'hsl(150, 100%, 50%)',
            'medium' : 'hsl(120, 100%, 50%)',
                    'medium high' : 'hsl(90, 100%, 50%)',
            'high' : 'hsl(60, 100%, 50%)',
                        'very high' : 'hsl(30, 100%, 50%)',                
            'highest' : 'hsl(0, 100%, 50%)',
            defaultFill: '#999'
        },
        geographyConfig: {
            popupTemplate: function(geography, data) {
                var text;
                var entry = data[sel.val()];
                if (entry.type === 'percent') text = entry.value + '%';
                else if (entry.type === 'money') text = '$' + entry.value;
                else text = entry.value;

                return '<div class="hoverinfo">' + geography.properties.name + '<br>' + text + '</div>';
            },
        },
        data: jsondata
    });
    
    var geo = map.usaTopo.objects.usa.geometries;
    for (var i = 0; i < geo.length; i++) {
        if (typeof jsondata[geo[i].id] !== "undefined") {
            jsondata[geo[i].id].label_full = geo[i].properties.name;
        }
    }

    //draw a legend for this map
    map.legend();
    map.labels();

    /***
     *** D3JS Animated Pie Chart
     ***/
   
    var createPie = (function(){

        var width = $(document).width();
        var height = $(document).height();
        var radius = Math.min(width, height) / 2 - 50;
        var donutWidth = 150;
        var legendRectSize = 10;
        var legendSpacing = 3;
        var color = d3.scale.category20b();
        var svg = d3.select('#chart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(' + ((width / 2)-(width*0.1)) + ',' + ((height / 2)+(10)) + ')');

            var arc = d3.svg.arc()
            .innerRadius(radius - donutWidth)
            .outerRadius(radius);
            var pie = d3.layout.pie()
            .value(function(d) { return parseFloat(d[selectVal].value); })
            .sort(null);
            var tooltip = d3.select('#chart')
            .append('div')
            .attr('class', 'tooltip');

            tooltip.append('div')
            .attr('class', 'label');
            tooltip.append('div')
            .attr('class', 'count');
            tooltip.append('div')
            .attr('class', 'percent');

            function createPie(dataset) {
                dataset.forEach(function(d) {
                    d.enabled = true;                                         // NEW
                });
                var path = svg.selectAll('path')
                    .data(pie(dataset))
                    .enter()
                    .append('path')
                    .attr('d', arc)
                    .attr('fill', function(d, i) { 
                        return color(d.data.label); 
                    })                                                        // UPDATED (removed semicolon)
                .each(function(d) { this._current = d; });                // NEW
                path.on('mouseover', function(d) {
                    d3.select(this)
                        .attr('fill', function(d, i) { 
                            return d3.rgb(color(d.data.label)).brighter().toString(); 
                        });

                    var total = d3.sum(dataset.map(function(d) {
                        return (d.enabled) ? parseFloat(d[selectVal].value) : 0;                       // UPDATED
                    }));

                    //TODO Figure out why some selections cause issues
                    var percent = Math.round(1000 * parseFloat(d.data[selectVal].value) / total) / 10;
                    tooltip.select('.label').html(d.data.label_full);
                    tooltip.select('.count').html(d.data[selectVal].value); 
                    tooltip.select('.percent').html(percent + '%'); 
                    tooltip.style('display', 'block');
                });

                path.on('mouseout', function() {
                    d3.select(this)
                        .attr('fill', function(d, i) { 
                            return color(d.data.label); 
                        });

                    tooltip.style('display', 'none');
                });
                path.on('mousemove', function(d) {
                    tooltip.style('top', (d3.event.pageY + 10) + 'px')
                        .style('left', (d3.event.pageX + 10) + 'px');
                });
            };
            return createPie;
    })();
    createPie(jsonarray);

    var createBar = (function(){
        var margin = {top: 50, right: 250, bottom: 40, left: 30};
        var width = $(document).width() - (margin.left + margin.right);
        var height = $(document).height() - (margin.top + margin.bottom);
        var color = d3.scale.category20b();        

        var x = d3.scale.ordinal()
            .rangeRoundBands([0, width], .1);

        var y = d3.scale.linear()
            .range([height, 0]);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(10);

        var svg = d3.select("#bar").append("svg")
            .attr("width", width + margin.top + margin.bottom)
            .attr("height", height + margin.left + margin.right)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var tooltip = d3.select('#bar')
            .append('div')
            .attr('class', 'tooltip');

            tooltip.append('div')
            .attr('class', 'label');
            tooltip.append('div')
            .attr('class', 'count');
            tooltip.append('div')
            .attr('class', 'percent');


        function createBar(data) {
            x.domain(data.map(function(d) { return d.label; }));
            y.domain([0, d3.max(data, function(d) { return parseFloat(d[selectVal].value); })]);

            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            svg.append("g")
                .attr("class", "y axis")
                .call(yAxis)
                .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em")
                .style("text-anchor", "end")

            var bar = svg.selectAll(".bar")
                .data(data)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) { return x(d.label); })
                .attr("width", x.rangeBand())
                .attr("y", function(d) { return y(d[selectVal].value); })
                .attr("height", function(d) { return height - y(d[selectVal].value); })
                .attr('fill', function(d, i) { 
                    return color(d.label); 
                }) ;

            bar.on('mouseover', function(d) {
                d3.select(this)
                    .attr('fill', function(d, i) { 
                        return d3.rgb(color(d.label)).brighter().toString(); 
                    });
                    
                    tooltip.select('.label').html(d.label_full);
                    tooltip.select('.count').html(d[selectVal].value); 
                    tooltip.style('display', 'block');

            });

            bar.on('mouseout', function() {
                d3.select(this)
                    .attr('fill', function(d, i) { 
                        return color(d.label); 
                    });

            });

            bar.on('mousemove', function(d) {
                tooltip.style('top', (d3.event.pageY + 10) + 'px')
                    .style('left', (d3.event.pageX + 10) + 'px');
            });


        };

        return createBar;
    })();


    createBar(jsonarray);

});

$(function(){
    $(':radio').click(function() {
        $('#' + $(this).attr('trigger')).fadeIn().siblings('div').hide();
    })
    .filter(':checked').click();//trigger the click event
});
