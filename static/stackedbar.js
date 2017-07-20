window.onload = function () {
    var chart = new CanvasJS.Chart("chartContainer",
    {
      title:{
      text: "Journey Times in Minutes"
      },
        data: [
      {
        type: "stackedColumn",
        legendText: "Wait time",
			  showInLegend: "true",
        dataPoints: [
        {  y: 111338 , label: "Scheduled"},
        {  y: 49088, label: "Actual" },
        ]
      },  {
        type: "stackedColumn",
        legendText: "on-board time",
			  showInLegend: "true",
        dataPoints: [
        {  y: 135305 , label: "Scheduled"},
        {  y: 107922, label: "Actual" },
        ]
      }
      ]
    });

    chart.render();
  }
