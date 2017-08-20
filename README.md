# NYC Bus Stats
### CUSP <--> TransitCenter
This web app was developed as a capstone project @ NYU's Center for Urban Science and Progress ([CUSP](http://cusp.nyu.edu/)), in partnership with the transit advocacy group, [TransitCenter](http://transitcenter.org).

## Strategy
As MTA buses continue to lose ridership to an increasingly overloaded subway system, TransitCenter seeks to identify weak points in the bus system where high-impact investments could be made to re-balance ridership, and improve overall transit quality. As an early step in that initiative, this dashboard is equal parts government advocacy and public engagement. The app fetches daily MTA GTFS data to produce various bus service reliability metrics, sliceable by direction, hour, and day, for ~200 of New York City's most popular bus routes. Historical data dating back to December 2016 provides seasonal trends. Data is resolved at the bus-stop level, allowing a user to drill into specific stop-to-stop journeys of interest. For more information on the project, visit http://www.busstat.nyc/methodology.

## Tech Stack
  - Python Flask on the back end
  - PostgreSQL
  - leaflet.js for custom map functionality
  - plotly.js for charts
  - Bootstrap
  - good ol' fashioned Javascript & jQuery

### A potentially useful tool
As part of the project, a python module that builds detailed and up-to-date geojson files for each of the MTA's bus routes in NYC was developed:
https://github.com/ian-wright/mta-bus-geojson
