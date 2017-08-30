-- purpose: This query gives an all-time route-ranking of the "route lateness factor",
-- 			which is calculated using count-weighted averages as:
--				(((mean stop wait time + mean full route trip time) /
--				(scheduled stop wait time + scheduled full route trip time)) - 1) * 100%)
-- author: Ian Wright
-- date: August 30, 2017

SELECT waits.route
	, ROUND(((((awt_weighted_average + m_trip_weighted_avg) / (swt_weighted_average + s_trip_weighted_avg)) - 1) * 100)::NUMERIC, 2) AS RLF
FROM (
	SELECT 
		SUM(full_route_daily_s_trip_sum * full_route_daily_count) / SUM(full_route_daily_count) AS s_trip_weighted_avg
		, SUM(full_route_daily_m_trip_sum * full_route_daily_count) / SUM(full_route_daily_count) AS m_trip_weighted_avg
		, route
	FROM (
		SELECT 
			SUM(s_trip) AS full_route_daily_s_trip_sum
			, SUM(m_trip) AS full_route_daily_m_trip_sum
			, SUM(count) AS full_route_daily_count
			, SPLIT_PART(rds_index, '_', 1) AS route
			, date
		FROM stop_metrics
		WHERE hourbin = 0
		GROUP BY date, SPLIT_PART(rds_index, '_', 1)
	) AS full_route_daily
	GROUP BY route
) as trips
INNER JOIN (
	SELECT 
		SUM(swt * count) / SUM(count) AS swt_weighted_average
		, SUM(awt * count) / SUM(count) AS awt_weighted_average
		, SPLIT_PART(rds_index, '_', 1) AS route
	FROM stop_metrics
	WHERE hourbin = 0
	GROUP BY SPLIT_PART(rds_index, '_', 1)
) as waits
ON trips.route = waits.route
ORDER BY RLF DESC



