(function(){

	var tc = {

		selection: {
            route: null,
             stop: null,
            direction: null,
            dayBin: null,
            hourBin: null,
            date: null
        },

        data: null,

		initialize: function(data) {
			this.data = data;

			// print header
			$("#bus_id").text(data["route_id"] + ": " + data["long_name"]);

			// set direction headsign selection options
			$("#dir0").text(data["directions"]["0"]["headsign"]);
			$("#dir1").text(data["directions"]["1"]["headsign"]);

			// dynamically insert date select options
			var counter = 0;
			Object.keys(data["directions"]["0"]["daybins"]["0"]["hourbins"]["0"]).reverse().forEach(function(day){
				if (counter == 0) {
					var option_elem = `<option name="date" value="${day}" selected="selected">${day}</option>`
				} else {
					var option_elem = `<option name="date" value="${day}">${day}</option>`
				};
				$("#dateSelect").append(option_elem);
				counter++;
			});

			this.updateSelection();
			this.registerHandlers();
		},

		updateSelection: function() {	
			console.log("updating selection...");
			tc.selection.route = tc.data["route_id"];
			tc.selection.dayBin = $("input[name=daybin]:checked", "#daySelect").val();
			tc.selection.hourBin = $("input[name=hourbin]:checked", "#hourSelect").val();
			tc.selection.direction = $("option[name=direction]:selected", "#dirSelect").val();
			tc.selection.date = $("option[name=date]:selected", "#dateSelect").val();
			tc.refreshTable();
		},

		refreshTable: function() {
			console.log("refreshing table...");
			// clear existing table
			$("#dataTable").empty();
			// write a header row
			$("#dataTable").append(`<tr><th>Stop</th><th>EWT</th></tr>`);
			// write data rows
			tc.data["directions"][tc.selection.direction]
					 ["daybins"][tc.selection.dayBin]
					 ["hourbins"][tc.selection.hourBin]
					 [tc.selection.date]
					 .forEach(function(stop){
					 	$("#dataTable").append(`<tr><td>${stop[0]}</td><td>${stop[1]}</td></tr>`);
					 });
		},

		registerHandlers: function() {
			$("#daySelect, #hourSelect, #dirSelect, #dateSelect").on("change", this.updateSelection);
		}

	};
	// add our tc object to global window scope
	this.tc = tc;
})();