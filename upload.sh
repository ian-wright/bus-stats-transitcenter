#!/bin/bash
for i in `seq 14 20`;
do
    python db_load.py pythonanywhere prod "data_/prod/prod${i}_j.csv" "data_/prod/prod${i}_r.csv" add
done   
