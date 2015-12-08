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
                jsondata[stateName][fieldName] = {name: fieldText, type: fieldType, value: data[i][j]};
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
    
    /*** 
     *** D3JS Choropleth Heat Map
     ***/

    function updateData() {
        for (var key in jsondata) {
            jsondata[key].fillKey = jsondata[key][this.value].fillKey;
        }
        map.updateChoropleth(jsondata);

        $("#chart svg g *").remove()
        createPie(jsonarray);
        selectVal = this.value;

    };

    var sel = $('<select>').prependTo('#controller').css({'float':'right'});
    var desc = $('<div>').appendTo('#controller').css({'position':'absolute','bottom':'8px'});
    desc.append($('<h1>').text(dataset.meta.view.name).css({'font-family':'sans-serif'}));
    desc.append($('<p>').text(dataset.meta.view.description).css({'font-family':'sans-serif','font-size':'14px'}));
    sel.change(updateData);

    for (var key in jsondata['NATION']) {
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

    //draw a legend for this map
    map.legend();
    map.labels();

    /***
     *** D3JS Animated Pie Chart
     ***/
     var jsonarray = Object.keys(jsondata).map(function(k) { 
         jsondata[k].label = k; 
         return jsondata[k];
     })

    var width = $(document).width();
    var height = $(document).height() - 20;
    var radius = Math.min(width, height) / 2;
    var donutWidth = 150;
    var legendRectSize = 10;
    var legendSpacing = 3;
    var color = d3.scale.category20b();
    var svg = d3.select('#chart')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + ((width / 2)-(width*0.1)) + 
        ',' + (height / 2) + ')');
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
        tooltip.select('.label').html(d.data.label);
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
    createPie(jsonarray);
});

$(function(){
    $(':radio').click(function() {
        $('#' + $(this).attr('trigger')).fadeIn().siblings('div').hide();
    })
    .filter(':checked').click();//trigger the click event
});
