/*
function init() {
            var myLatlng = new google.maps.LatLng(-3.71969,-38.52562);
            var myOptions = {
              zoom: 13,
              center: myLatlng,
              mapTypeId: google.maps.MapTypeId.ROADMAP
            }
            
            var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

            var options = {
                map: map,
                distance: 0.5, // Starting distance in km.
                maxDistance: 2500, // Twitter has a max distance of 2500km.
                color: '#000000',
                fillColor: '#5599bb',
                fillOpacity: '0.3',
                activeColor: '#5599bb',
                sizerIcon: new google.maps.MarkerImage('img/resize-off.png'),
                activeSizerIcon: new google.maps.MarkerImage('img/resize.png')
            }

            var drawingManager = new google.maps.drawing.DrawingManager({
              drawingMode: google.maps.drawing.OverlayType.MARKER,
              drawingControl: true,
              drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT,
                drawingModes: [google.maps.drawing.OverlayType.MARKER]
              },
              markerOptions: {
                draggable : true
              },
            });

            google.maps.event.addListener(drawingManager, 'markercomplete', function(marker) {
                new DistanceWidget(marker,options);
            });

            drawingManager.setMap(map)

            $(".addmarker").live("click",function() {
             drawingManager.setDrawingMode(google.maps.drawing.OverlayType.MARKER);
            });
            
}

        google.maps.event.addDomListener(window, 'load', init);
*/

    ich.grabTemplates();
    
    var Map = Backbone.Model.extend({
        
        initialize : function() {
            this.myLatlng = new google.maps.LatLng(-3.71969,-38.52562);
            this.myOptions = {
              zoom: 13,
              center: this.myLatlng,
              mapTypeId: google.maps.MapTypeId.ROADMAP
            }
            
            this.map = new google.maps.Map(document.getElementById("map_canvas"), this.myOptions);
            this.setArrows=new ArrowHandler(this.map);
            this.lines=[];
            this.fetch();

            this.drawingManager = new google.maps.drawing.DrawingManager({
              drawingMode: google.maps.drawing.OverlayType.MARKER,
              drawingControl: true,
              drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT,
                drawingModes: [google.maps.drawing.OverlayType.MARKER]
              },
              markerOptions: {
                draggable : true
              },
            });

            google.maps.event.addListener(this.drawingManager, 'markercomplete', function(marker) {
                busMap._markerList.add(marker);
            });

            this.drawingManager.setMap(this.map);
        },
        url:function() {
            //HACK because etufor data set is not consistent
            if(this.name!=undefined && this.name.length==2) {
                this.name=this.name+" -";
            }
            return "https://www.google.com/fusiontables/api/query?sql=SELECT geometry FROM 1628071 WHERE name STARTS WITH '"+this.name+"'&jsonCallback=?"
        },
        parse : function(response) {
            var setArrows=this.setArrows;
            var map=this.map;
            var lines=this.lines;
            
            //remove previous lines
            _.each(lines,function(line) {
                line.setMap(null);
            });
            
            //remove all previous arrows
            _.each(setArrows.arrows,function(arrow) {
                arrow.setMap(null);
            });
            //reinit set of arrows
            setArrows.arrows=[];
            
            //Parse response
            response.table.rows=_.flatten(response.table.rows);
            //For each coordinate, create a gmap.Latlng object, and display it
            response.table.rows=_(response.table.rows).each(function (row){
                row.coordinates=_(row.coordinates).map(function(coord) {
                    return new google.maps.LatLng(coord[1],coord[0]);
                });
                lines.push(createPoly(row.coordinates,"midline",setArrows,map));
            });
            
        },
        displayLine : function(name) {
            this.name=name;
            this.fetch();
        },
        getMap : function(){
          return this.map;
        },
    });
    
     var Marker = Backbone.Model.extend({
        initialize : function(marker) {
           var markerBone = this;
           this.marker = marker;

           this.markerOptions = {
                map: this.marker.map,
                distance: 0.5, // Starting distance in km.
                maxDistance: 2500, // Twitter has a max distance of 2500km.
                color: '#000000',
                fillColor: '#5599bb',
                fillOpacity: '0.3',
                activeColor: '#5599bb',
                sizerIcon: new google.maps.MarkerImage('img/resize-off.png'),
                activeSizerIcon: new google.maps.MarkerImage('img/resize.png')
            }

            //Attach DistanceWidgetto the marker
            this.distancewidget=new DistanceWidget(this.marker,this.markerOptions);

           google.maps.event.addListener(this.marker, 'dragend', function(mouse) {
             markerBone.fetch({success: function(model,response){
                busMap._markerList.updateLineList();
             }});
            });
            markerBone.fetch({success: function(model,response){
                    busMap._markerList.updateLineList();
            }});
        },
        url:function() {
           return "https://www.google.com/fusiontables/api/query?sql=SELECT name FROM 1628071 WHERE ST_INTERSECTS(geometry,CIRCLE(LATLNG"+this.marker.position+",1000))&jsonCallback=?"
        },
        parse : function(response) {
          response.table.rows=_.flatten(response.table.rows);
          response.table.rows=_.reject(response.table.rows,function(row) {
                if(row.split("-")[2]==" Volta") {
                    return true;
                }
                else {
                    return false;
                }
            });
            return response;
          },
         
    });
     
    var MarkerList = Backbone.Collection.extend({
            _view : null,
            model: Marker,
            updateLineList : function() {
                this._view=new MarkerListView({model : this});
                this._view.render();
                if(this.models.length>0) {
                busMap._lineList._view=new LineListView({model : this.computeLineList()});
                busMap._lineList._view.renderJSON();
                }
                else {
                    busMap._lineList.reinit();
                }
                
            },
            computeLineList : function(){
                var markers_routes = this.models.map(function(mark){return mark.attributes.table.rows});
                var rotas = arrayIntersection(markers_routes);
                return {table: {rows: rotas.map(function(row) {
                  var array=row.split("-");
                  return { num: array[0],label: array[0]+array[1]};
                })}};
            },
            toJSON : function() {
                var listMarkers=this.models;
                return {models: _.map(listMarkers,function(mark,i) {
                                return {num: i+1,index: i};
                                })};
            },
            removeByIndex : function(index) {
                var markerToRemove=this.at(index);
                markerToRemove.marker.setMap(null);
                this.remove(markerToRemove);
                this.updateLineList();
            }
    });
    
    var MarkerListView = Backbone.View.extend({
        el : $("#listmarkers"),
        render : function() {
            //console.log(this.model.toJSON());
            this.$el.html(ich.markerList(this.model.toJSON()));
            return this;
        }
        
    });

    var LineList = Backbone.Model.extend({
        _view : null,
        
        initialize : function() {
            this.fetch();
            this.bind("change", function() {
                this._view=new LineListView({model : this});
                this._view.render();
            });
        },
        url:function() {
            return "https://www.google.com/fusiontables/api/query?sql=SELECT name FROM 1628071&jsonCallback=?"
        },
        parse : function(response) {
            response.table.rows=_.flatten(response.table.rows);
            response.table.rows=_.reject(response.table.rows,function(row) {
                if(row.split("-")[2]==" Volta") {
                    return true;
                }
                else {
                    return false;
                }
            });
            response.table.rows=_.map(response.table.rows,function(row) {
                var array=row.split("-");
                return { num: array[0],label: array[0]+array[1]};
            });
            return response;
        },
        reinit : function() {
            this.fetch();
            this._view=new LineListView({model : this});
            this._view.render();
        }
    });
    
    var LineListView = Backbone.View.extend({
        el : $("#listlines"),
        render: function() {
            this.$el.html(ich.lineList(this.model.toJSON()));
            $("#listlinestable").html(ich.lineListTable(this.model.toJSON())); //HACK
            $(".chzn-select").chosen({no_results_text: "No results matched"}).change(function () {
                 busMap.navigate("line/"+$(".chzn-select").val(),true);
            });
            busMap.navigate("line/"+$(".chzn-select").val(),true);
            return this;
        },
        renderJSON: function() {
            this.$el.html(ich.lineList(this.model));
            $("#")
            $(".chzn-select").chosen({no_results_text: "No results matched"}).change(function () {
                 busMap.navigate("line/"+$(".chzn-select").val(),true);
            });
            busMap.navigate("line/"+$(".chzn-select").val(),true);
            return this;
        }
    });
    
    var BusMap = Backbone.Router.extend({
        
        routes : {
            "":             "index",
            "line/:name":   "displayLine"
        },
        
        initialize : function() {
            this._lineList=new LineList();
            this._markerList=new MarkerList();
            this._map=new Map();
        },
        
        index : function() {
        },
        
        getMap : function(){
           return this._map.getMap();
        },

        displayLine : function(name) {
            this._map.displayLine(name);
        }
        
    });
    
    var busMap=new BusMap();
    
    Backbone.history.start();