var app={};

app.params = {
    urlFusionTable : "https://www.googleapis.com/fusiontables/v1/query",
    idFusionTable: "1ugP-dIxvkhmfuMNfZo_NyIQs5kMGpaFMbP7YG2o",
    keyFusionTable: "AIzaSyC59BP_KRtQDLeb5XM_x0eQNT_tdlBbHZc"
}

app.main = function() {

    var Map = Backbone.Model.extend({

    _fitBounds : false,
    
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
        
        var theMap=this;

        this.drawingManager = new google.maps.drawing.DrawingManager({
          drawingMode: null,
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
        var drawingManager=this.drawingManager;

        $(".addmarker").bind("touchstart click",function() {
            busMap._markerList.add(new google.maps.Marker({position: busMap.getMap().center ,
                                                            map: busMap.getMap() ,
                                                            draggable: true}));
        });

        $("#searchAddress").bind("submit", function(e){
            var address = document.getElementById('address').value;
            busMap._mapAddressFinder.addMarkerAtAddress(address);
            e.preventDefault();
        });

    },
    url:function() {
        //HACK because etufor data set is not consistent
        if(this.name!=undefined && this.name.length==2) {
            this.name=this.name+" -";
        }
        return app.params.urlFusionTable+"?sql=SELECT geometry FROM "+app.params.idFusionTable+" WHERE name STARTS WITH '"+this.name+"'&key="+app.params.keyFusionTable+"&callback=?";
    },
    parse : function(response) {
        //Clear map
        this.clear();

        var lines=this.lines;
        var setArrows=this.setArrows;
        var map=this.map;
        
        //Parse response
        response.rows=_.flatten(response.rows);

        //if line found
        if(response.rows.length>0) {

        //Bounds to get the center of the line
        var bounds = new google.maps.LatLngBounds();

        //For each coordinate, create a gmap.Latlng object, and display it
        response.rows=_.each(response.rows,function (row){
            row.geometry.coordinates=_.map(row.geometry.coordinates,function(coord) {
                var coordinate=new google.maps.LatLng(coord[1],coord[0]);
                bounds.extend(coordinate);
                return coordinate;

            });
            lines.push(createPoly(row.geometry.coordinates,"midline",setArrows,map));
        });

        if(this._fitBounds) { 
            this.map.fitBounds(bounds);
        }

        }

        busMap.ready();

        this._fitBounds=false;
    },
    displayLine : function(name) {
        busMap.loading();
        this.name=name;
        this.fetch();
    },
    getMap : function(){
      return this.map;
    },
    clear : function() {
        //remove previous lines
        _.each(this.lines,function(line) {
            line.setMap(null);
        });
        
        //remove all previous arrows
        _.each(this.setArrows.arrows,function(arrow) {
            arrow.setMap(null);
        });
        //reinit set of arrows
        this.setArrows.arrows=[];
    }
});

var MapAddressFinder = Backbone.Model.extend({
    _geocoder : new google.maps.Geocoder(),
    _fortalezaBounds : new google.maps.LatLngBounds(new google.maps.LatLng(-3.87,-38.65),new google.maps.LatLng(-3.691682,-38.4)),

    addMarkerAtAddress : function(address) {
      this.locationForAddress(address,function(firstHitLocation){
        busMap.getMap().setCenter(firstHitLocation);
        busMap._markerList.add(new google.maps.Marker({ position: firstHitLocation,
                                                        map: busMap.getMap(),
                                                        draggable: true }));
      });
    },

    forceResultsInBounds : function(results, bounds){
      return _.select(results,function(result){
        return bounds.contains(result.geometry.location);
      });
    },

    locationForAddress : function(address,callback) {
      var addressFinder = this;
      this._geocoder.geocode( { 'address': address , 'bounds': this._fortalezaBounds , 'region': 'br'}, function(results, status) {

       var resultsInFortaleza = addressFinder.forceResultsInBounds(results, addressFinder._fortalezaBounds);

        if (status == google.maps.GeocoderStatus.OK && resultsInFortaleza.length>0) {
          $(".noaddressfound").addClass("hidden");
          callback(resultsInFortaleza[0].geometry.location);
        } else {
          $(".noaddressfound").removeClass("hidden");
        }
      });
    }
});

 var Marker = Backbone.Model.extend({
    initialize : function(marker) {
       var me = this;
       this.marker = marker;
       this._radius=500; //initialize radius
       this.name = marker.name;

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
        this.distanceWidget=new DistanceWidget(this.marker,this.markerOptions);
        var currentDistanceWidget=this.distanceWidget;

        google.maps.event.addListener(currentDistanceWidget.radiusWidget.circle, 'active_changed', function() {
            me._radius=currentDistanceWidget.get('distance')*1000;
            me.fetchLines(); 
        });

        
       google.maps.event.addListener(this.marker, 'dragend', function(mouse) {
         me.fetchLines();

        });

        this.fetchLines();
    },
    url:function() {
       return app.params.urlFusionTable+"?sql=SELECT name FROM "+app.params.idFusionTable+" WHERE ST_INTERSECTS(geometry,CIRCLE(LATLNG("+this.marker.getPosition().lat()+","+this.marker.getPosition().lng()+"),"+this._radius+"))&key="+app.params.keyFusionTable+"&callback=?";
    },
    parse : function(response) {
      response.rows=_.flatten(response.rows);
      //we remove the last part of the 
      response.rows=_.map(response.rows,function(row) {
          var array=row.split("-");
          return array[0]+"-"+array[1];
      });
      //throw away duplicate values
      response.rows=_.uniq(response.rows);

      return response;
    },
    fetchLines:function() {
        busMap.loading();
        this.fetch({
            success: function(model,response){
              busMap._markerList.updateLineList();
              console.log("Success updating list");
            },
            error: function() {
              console.log("Error while updating list");
            }    
          }); 
    }
     
});
 
var MarkerList = Backbone.Collection.extend({
        _view : null,
        model: Marker,
        updateLineList : function() {
            this._view=new MarkerListView({model : this});
            this._view.render();
            var listLines=this.computeLineList();
            //if there is marker on the map
            if(this.models.length>0) {
                busMap._lineList.set(this.computeLineList());
                busMap._lineList.updateViews();
                //if there are lines corresponding
                if(listLines.rows.length>0) {
                    busMap.displayLine(listLines.rows[0].num)
                    //HACK: no more marker TODO: change the logic
                    busMap.linesFound();
                }
                else {
                    busMap.noLinesFound();
                }
            }
            else {
                busMap._lineList.reinit();
                //HACK: no more marker TODO: change the logic
                busMap.linesFound();
            }
            
        },
        computeLineList : function(){
            var markers_routes = this.models.map(function(mark){return mark.attributes.rows});
            var linesIntersection=_.intersection.apply(this,markers_routes);
            var response={
                rows: linesIntersection.map(function(row) {
                  var array=row.split("-");
                  return { num: array[0],label: array[0]+array[1]};
                }),
                _totalLines : linesIntersection.length
            };
            return response;
        },
        toJSON : function() {
            var listMarkers=this.models;
            return {models: _.map(listMarkers,function(mark,i) {
                            if(mark.name){
                              return {name: mark.name, index: i};
                            }else{
                              return {name: 'Ponto '+(i+1),index: i};
                            };
                            })};
        },
        removeByIndex : function(index) {
            var markerToRemove=this.at(index);
            this.remove(markerToRemove);
            markerToRemove.marker.setMap(null);
            markerToRemove.distanceWidget=null;
            this.updateLineList();
        }
});

var MarkerListView = Backbone.View.extend({
    el : $("#listmarkers"),
    render : function() {
        $(this.$el).html(ich.markerList(this.model.toJSON()));
        return this;
    }
    
});

var LineList = Backbone.Model.extend({
    _viewSelect : null,
    _viewSidebar: null,
    _totalLines : null,
    
    initialize : function() {
        var me=this;
        this.bind("change", function() {
            me.updateViews();
        });
        this.fetch();
    },
    url:function() {
        return app.params.urlFusionTable+"?sql=SELECT name FROM "+app.params.idFusionTable+"&key="+app.params.keyFusionTable+"&callback=?";
    },
    parse : function(response) {
        response.rows=_.flatten(response.rows);

        //if line found
        if(response.rows.length>0) {

            busMap.maintenanceMode(false);
        }
        else {
            busMap.maintenanceMode(true);
        }

        var rowTampon="";
        
        response.rows=_.reject(response.rows,function(row) {
            if(row.split("-")[2]==" Volta" && row.split("-")[1]==rowTampon) {
                rowTampon=row.split("-")[1];
                return true;
            }
            else {
                rowTampon=row.split("-")[1];
                return false;
            }
        });
        
        response.rows=_.map(response.rows,function(row) {
            var array=row.split("-");
            return { num: array[0],label: array[0]+array[1]};
        });

        response._totalLines=response.rows.length;

        return response;
    },
    reinit : function() {
        this.fetch();
        this.updateViews();
        busMap._map.clear();
    },
    updateViews : function() {
        this._viewSelect=new LineListSelectView({model : this});
        this._viewSelect.render();
        this._viewSidebar=new LineListSidebarView({model:this});
        this._viewSidebar.render();
        busMap.trigger("finishListLoading");
    }
});

var LineListSelectView = Backbone.View.extend({
    el : $("#linelistselect"),
    render: function() {
        $(this.$el).html(ich.lineListSelect(this.model.toJSON()));
        var me=this;
        $(".chzn-select").chosen().change(function () {
             busMap._map._fitBounds=true;
             var num=$(".chzn-select").val();
             busMap.displayLine(num);
        });
        return this;
    },
    setSelected : function(numLine) {
        $(".chzn-select").val(numLine+' ');
        $(".chzn-select").trigger("liszt:updated");
    },
});

var LineListSidebarView = Backbone.View.extend({
    el : $("#linelistsidebar"),
    render: function() {
        $(this.$el).html(ich.lineListSidebar(this.model.toJSON()));
        $("#linelistsidebar td").bind("click touchstart",function (e) { 
             var num=$(this).attr("data-num");
             busMap._map._fitBounds=true;
             busMap.displayLine(num);
             return false;
        });
        return this;
    },
    setSelected: function(numLine) {
        $("#linelistsidebar tr").removeClass("selected");
        $("#linelistsidebar td:contains("+numLine+")").parent().addClass("selected");
    }
});

var BusMap = Backbone.Router.extend({
    
    routes : {
        "":             "index",
        "line/:num":    "displayLine",
        "about":        "about",
    },
    
    initialize : function() {
        this.loading();
        this._lineList=new LineList();
        this._markerList=new MarkerList();
        this._map=new Map({ _fitBounds: true});
        this._mapAddressFinder = new MapAddressFinder();
        this.ready();
    },
    
    index : function() {
        this.switchToPage("main");
    },
    
    getMap : function(){
       return this._map.getMap();
    },



    displayLine : function(num) {
        this.on("finishListLoading",function() {
            this._lineList._viewSelect.setSelected(num);
            this._lineList._viewSidebar.setSelected(num);
        })
        busMap.navigate("line/"+num);
        this._map.displayLine(num);
        this._lineList._viewSelect.setSelected(num);
        this._lineList._viewSidebar.setSelected(num);
    },

    noLinesFound : function() {
        $(".nolinesfound").removeClass("hidden");
        this._map.ready();
        this._map.clear();
    },

    linesFound : function() {
        $(".nolinesfound").addClass("hidden");
        $(".noaddressfound").addClass("hidden");
    },

    maintenanceMode : function(active) {
        if(active) {
            $(".maintenance").removeClass("hidden");
        }
        else {
            $(".maintenance").addClass("hidden");
        }
    },

    about : function() {
        this.switchToPage("about");
    },

    switchToPage : function(destination) {
        $(".page").hide();
        $(".nav li").removeClass("active");
        $("#"+destination).show();
        $("."+destination).addClass("active");
    },
    loading : function() {
        $("body").css("cursor","progress");  //TODO : Refacto in Less file
        $(".loading").removeClass("hidden");
    },
    ready : function() {
        $(".loading").addClass("hidden");
        $("body").css("cursor","auto");
    }
});

var busMap=new BusMap();

Backbone.history.start();

return {
    map : busMap
}

}();

