#!/bin/sh

##parameters
chrlensfile="../Example_Data/chromosome_sizes.txt"
res=5000
threads=50
EXE_PATH="../sBIF/bin/sBIF"
n_samples=$1
n_samples_per_run=$2
is_download=$3

count=1
total_files=$(find ../Example_Data/Folding_input -name "*.txt" | wc -l | xargs)


for interfile in ../Example_Data/Folding_input/*.txt; do
    filename=$(basename "$interfile")
    
    # Extract cell_line, chromosome, start, and end from the filename
    cell_line=$(echo "$filename" | cut -d'.' -f1)
    chrom=$(echo "$filename" | cut -d'.' -f2)
    start=$(echo "$filename" | cut -d'.' -f3)
    end=$(echo "$filename" | cut -d'.' -f4 | sed 's/.txt//')
    job_prefix="$chrom"

    ##command
    cmd="$EXE_PATH -i $interfile -c $chrom -l $chrlensfile -s $start -e $end -ns $n_samples -nr $n_samples_per_run -cl $cell_line -r $res -do $is_download -j $job_prefix -p $threads"
    
    echo "Processing file $count of $total_files: $filename"
    echo "Running command: $cmd"
    
    $cmd
    count=$((count + 1))  
done

echo "Done."