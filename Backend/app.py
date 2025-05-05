import os
from flask import Flask, jsonify, request, after_this_request
from process import (
    gene_names_list, 
    cell_lines_list, 
    chromosome_size, 
    chromosomes_list, 
    chromosome_sequences, 
    chromosome_data, 
    example_chromosome_3d_data, 
    comparison_cell_line_list, 
    gene_list, 
    gene_names_list_search, 
    chromosome_size_by_gene_name, 
    chromosome_valid_ibp_data, 
    epigenetic_track_data, 
    download_full_chromosome_3d_distance_data, 
    download_full_chromosome_3d_position_data,
    bead_distribution, 
    exist_chromosome_3d_data
    )
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return 'Hello, World!'


@app.route('/getGeneNameList', methods=['GET'])
def get_GeneNameList():
    return jsonify(gene_names_list())


@app.route('/getCellLines', methods=['GET'])
def get_CellLines():
    return jsonify(cell_lines_list())


@app.route('/getChromosList', methods=['POST'])
def get_ChromosList():
    cell_line = request.json['cell_line']
    return jsonify(chromosomes_list(cell_line))


@app.route('/getChromosSize', methods=['POST'])
def get_ChromosSize():
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_size(chromosome_name))


@app.route('/getChromosSizeByGeneName', methods=['POST'])
def get_ChromosSizeByGeneName():
    gene_name = request.json['gene_name']
    return jsonify(chromosome_size_by_gene_name(gene_name))


@app.route('/getChromosSequence', methods=['POST'])
def get_ChromosSequences():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_sequences(cell_line, chromosome_name))


@app.route('/getChromosData', methods=['POST'])
def get_ChromosData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(chromosome_data(cell_line, chromosome_name, sequences))


@app.route('/getChromosValidIBPData', methods=['POST'])
def get_ChromosValidIBPData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(chromosome_valid_ibp_data(cell_line, chromosome_name, sequences))


@app.route('/getExistingChromos3DData', methods=['POST'])
def get_ExistingChromos3DData():
    cell_line = request.json['cell_line']
    sample_id = request.json['sample_id']
    return jsonify(exist_chromosome_3d_data(cell_line, sample_id))


@app.route('/getExampleChromos3DData', methods=['POST'])
def get_ExampleChromos3DData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    sample_id = request.json['sample_id']
    return jsonify(example_chromosome_3d_data(cell_line, chromosome_name, sequences, sample_id))


@app.route('/getComparisonCellLineList', methods=['POST'])
def get_ComparisonCellLines():
    cell_line = request.json['cell_line']
    return jsonify(comparison_cell_line_list(cell_line))


@app.route('/getGeneList', methods=['POST'])
def get_GeneList():
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(gene_list(chromosome_name, sequences))


@app.route('/getepigeneticTrackData', methods=['POST'])
def get_epigeneticTrackData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(epigenetic_track_data(cell_line, chromosome_name, sequences))


@app.route('/geneListSearch', methods=['POST'])
def geneListSearch():
    search = request.json['search']
    return jsonify(gene_names_list_search(search))


@app.route('/downloadFullChromosome3dDistanceData', methods=['POST'])
def downloadFullChromosome3dDistanceData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    file_path, npz_file = download_full_chromosome_3d_distance_data(cell_line, chromosome_name, sequences)

    @after_this_request
    def remove_file(response):
        try:
            os.remove(file_path)
            app.logger.info("Deleted temporary npz file: %s", file_path)
        except Exception as error:
            app.logger.error("Failed to delete npz file: %s", error)
        return response
    return npz_file

@app.route('/downloadFullChromosome3dPositionData', methods=['POST'])
def downloadFullChromosome3dPositionData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    file_path, csv_file = download_full_chromosome_3d_position_data(cell_line, chromosome_name, sequences)

    @after_this_request
    def remove_file(response):
        try:
            os.remove(file_path)
            app.logger.info("Deleted temporary csv file: %s", file_path)
        except Exception as error:
            app.logger.error("Failed to delete csv file: %s", error)
        return response
    return csv_file

@app.route('/getBeadDistribution', methods=['POST'])
def getBeadDistribution():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    indices = request.json['indices']
    return jsonify(bead_distribution(cell_line, chromosome_name, sequences, indices))


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)
