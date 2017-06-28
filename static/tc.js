(function(){

	var tc = {

		selection: {
            route: null,
            // stop: null,
            direction: null,
            dayBin: null,
            hourBin: null,
            date: null
        },

		initialize: function(data) {

			$("#bus_id").text(data["route_id"] + ": " + data["long_name"]);

			// set direction headsign selection options
			$("#dir0").text(data["directions"]["0"]["headsign"]);
			$("#dir1").text(data["directions"]["1"]["headsign"]);

			// dynamically insert date select options
			var counter = 0;
			data["directions"]["0"]["daybins"]["0"]["hourbins"]["0"].reverse().forEach(function(day){
				var date = day[0];
				if (counter == 0) {
					var option_elem = `<option name="date" value="${date}" selected="selected">${date}</option>`
				} else {
					var option_elem = `<option name="date" value="${date}">${date}</option>`
				};
				$("#dateSelect").append(option_elem);
				counter++;
			});

			this.selection.route = data["route_id"];
			this.updateSelection();
		},

		updateSelection: function() {

			this.selection.dayBin = $("input[name=daybin]:checked", "#daySelect").val();
			this.selection.hourBin = $("input[name=hourbin]:checked", "#hourSelect").val();
			this.selection.direction = $("option[name=direction]:selected", "#dirSelect").val();
			this.selection.date = $("option[name=date]:selected", "#dateSelect").val();

			//this.refreshData();
		}

		//refreshData: function() {

		//}
	};
	this.tc = tc
})();
