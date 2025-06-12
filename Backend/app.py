import os
import orjson
from flask import Flask, jsonify, request, after_this_request, Response, Blueprint
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
    exist_bead_distribution, 
    exist_chromosome_3d_data
    )
import redis
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB   = int(os.getenv("REDIS_DB", 0))

# Create a Redis connection pool
redis_pool = redis.ConnectionPool(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
redis_client = redis.Redis(connection_pool=redis_pool)


api = Blueprint('api', __name__, url_prefix='/api')


@api.route('/getGeneNameList', methods=['GET'])
def get_GeneNameList():
    return jsonify(gene_names_list())


@api.route('/getCellLines', methods=['GET'])
def get_CellLines():
    return jsonify(cell_lines_list())


@api.route('/getChromosList', methods=['POST'])
def get_ChromosList():
    cell_line = request.json['cell_line']
    return jsonify(chromosomes_list(cell_line))


@api.route('/getChromosSize', methods=['POST'])
def get_ChromosSize():
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_size(chromosome_name))


@api.route('/getChromosSizeByGeneName', methods=['POST'])
def get_ChromosSizeByGeneName():
    gene_name = request.json['gene_name']
    return jsonify(chromosome_size_by_gene_name(gene_name))


@api.route('/getChromosSequence', methods=['POST'])
def get_ChromosSequences():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_sequences(cell_line, chromosome_name))


@api.route('/getChromosData', methods=['POST'])
def get_ChromosData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(chromosome_data(cell_line, chromosome_name, sequences))


@api.route('/getChromosValidIBPData', methods=['POST'])
def get_ChromosValidIBPData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(chromosome_valid_ibp_data(cell_line, chromosome_name, sequences))


@api.route('/getExistingChromos3DData', methods=['POST'])
def get_ExistingChromos3DData():
    cell_line = request.json['cell_line']
    sample_id = request.json['sample_id']
    # return jsonify(exist_chromosome_3d_data(cell_line, sample_id))
    payload = orjson.dumps(exist_chromosome_3d_data(cell_line, sample_id))
    return Response(payload, content_type='application/json')


@api.route('/getExampleChromos3DData', methods=['POST'])
def get_ExampleChromos3DData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    sample_id = request.json['sample_id']
    return jsonify(example_chromosome_3d_data(cell_line, chromosome_name, sequences, sample_id))


@api.route('/getComparisonCellLineList', methods=['POST'])
def get_ComparisonCellLines():
    cell_line = request.json['cell_line']
    return jsonify(comparison_cell_line_list(cell_line))


@api.route('/getGeneList', methods=['POST'])
def get_GeneList():
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(gene_list(chromosome_name, sequences))


@api.route('/getepigeneticTrackData', methods=['POST'])
def get_epigeneticTrackData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    return jsonify(epigenetic_track_data(cell_line, chromosome_name, sequences))


@api.route('/geneListSearch', methods=['POST'])
def geneListSearch():
    search = request.json['search']
    return jsonify(gene_names_list_search(search))


@api.route('/downloadFullChromosome3dDistanceData', methods=['POST'])
def downloadFullChromosome3dDistanceData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    is_example = request.json['is_example']
    file_path, npz_file = download_full_chromosome_3d_distance_data(cell_line, chromosome_name, sequences, is_example)

    @after_this_request
    def remove_file(response):
        try:
            os.remove(file_path)
            app.logger.info("Deleted temporary npz file: %s", file_path)
        except Exception as error:
            app.logger.error("Failed to delete npz file: %s", error)
        return response
    return npz_file


@api.route('/downloadFullChromosome3dPositionData', methods=['POST'])
def downloadFullChromosome3dPositionData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    is_example = request.json['is_example']
    file_path, csv_file = download_full_chromosome_3d_position_data(cell_line, chromosome_name, sequences, is_example)

    @after_this_request
    def remove_file(response):
        try:
            os.remove(file_path)
            app.logger.info("Deleted temporary csv file: %s", file_path)
        except Exception as error:
            app.logger.error("Failed to delete csv file: %s", error)
        return response
    return csv_file


@api.route('/getBeadDistribution', methods=['POST'])
def getBeadDistribution():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    indices = request.json['indices']
    return jsonify(bead_distribution(cell_line, chromosome_name, sequences, indices))


@api.route('/getExistBeadDistribution', methods=['POST'])
def getExistBeadDistribution():
    cell_line = request.json['cell_line']
    indices = request.json['indices']
    return jsonify(exist_bead_distribution(cell_line, indices))


@api.route('/getExample3DProgress', methods=['GET'])
def get_example_3d_progress():
    cell_line       = request.args['cell_line']
    chromosome_name = request.args['chromosome_name']
    start           = request.args['start']
    end             = request.args['end']
    sample_id       = request.args['sample_id']
    is_exist        = request.args['is_exist']

    if is_exist == 'true':
        key = f"{cell_line}:chr8:127300000:128300000:exist_{sample_id}_progress"
        val = redis_client.get(key)
        return jsonify(percent=int(val))
    else:
        key = f"{cell_line}:{chromosome_name}:{start}:{end}:{sample_id}_progress"
        val = redis_client.get(key)
        return jsonify(percent=int(val))


app.register_blueprint(api)


@app.route('/')
def index():
    return 'Hello, World!'


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)
