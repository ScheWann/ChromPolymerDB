import os
import orjson
import shutil
import redis
import hashlib, json as _json
from tasks import process_chromosome_3d, process_exist_chromosome_3d
from task_utils import make_task_signature, get_task_key
from celery_worker import celery_worker
from flask import Flask, jsonify, request, after_this_request, Response, Blueprint
from flask_cors import CORS
from process import (
    gene_names_list, 
    cell_lines_list, 
    chromosome_size, 
    chromosomes_list,
    chromosome_original_valid_sequences, 
    chromosome_merged_valid_sequences, 
    chromosome_data,
    comparison_cell_line_list, 
    gene_list, 
    gene_names_list_search, 
    chromosome_size_by_gene_name, 
    chromosome_valid_ibp_data, 
    epigenetic_track_data, 
    download_full_chromosome_3D_distance_data, 
    download_full_chromosome_3D_position_data,
    bead_distribution,
    exist_bead_distribution, 
    exist_chromosome_3D_data
)

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
def get_CellLinesList():
    return jsonify(cell_lines_list())


@api.route('/getChromosomesList', methods=['POST'])
def get_ChromosomesList():
    cell_line = request.json['cell_line']
    return jsonify(chromosomes_list(cell_line))


@api.route('/getChromosomeSize', methods=['POST'])
def get_ChromosomeSize():
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_size(chromosome_name))


@api.route('/getChromosomeSizeByGeneName', methods=['POST'])
def get_ChromosomeSizeByGeneName():
    gene_name = request.json['gene_name']
    return jsonify(chromosome_size_by_gene_name(gene_name))


@api.route('/getChromosomeOriginalValidSequence', methods=['POST'])
def get_ChromosomeOriginalValidSequences():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_original_valid_sequences(cell_line, chromosome_name))


@api.route('/getChromosMergedValidSequence', methods=['POST'])
def get_ChromosMergedValidSequences():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    return jsonify(chromosome_merged_valid_sequences(cell_line, chromosome_name))


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


@api.route('/getExistChromosome3DData', methods=['POST'])
def get_ExistChromosome3DData():
    cell_line = request.json['cell_line']
    sample_id = request.json['sample_id']
    payload = orjson.dumps(exist_chromosome_3D_data(cell_line, sample_id))
    return Response(payload, content_type='application/json')


@api.route('/getChromosome3DData', methods=['POST'])
def get_Chromosome3DData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    sample_id = request.json['sample_id']

    # Build a stable task signature to detect duplicates (same logic as in tasks.py)
    signature = make_task_signature(cell_line, chromosome_name, sequences, sample_id)

    # If the task is already registered, return its AsyncResult instead of queuing a new one
    task_key = get_task_key(signature)
    existing_task_id = redis_client.get(task_key)
    if existing_task_id:
        async_result = process_chromosome_3d.AsyncResult(existing_task_id.decode())
    else:
        async_result = process_chromosome_3d.apply_async(
            args=[cell_line, chromosome_name, sequences, sample_id]
        )
        # Store mapping so future identical requests reuse the same task
        redis_client.setex(task_key, 1800, async_result.id)  # 30 minutes TTL

    # Wait for the result so the response shape stays the same for the caller.
    result_data = async_result.get(timeout=None)

    return jsonify(result_data)


@api.route('/getComparisonCellLineList', methods=['POST'])
def get_ComparisonCellLineList():
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


@api.route('/geneNamesListSearch', methods=['POST'])
def geneNamesListSearch():
    search = request.json['search']
    return jsonify(gene_names_list_search(search))


@api.route('/getBeadDistribution', methods=['POST'])
def get_BeadDistribution():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    indices = request.json['indices']
    return jsonify(bead_distribution(cell_line, chromosome_name, sequences, indices))


@api.route('/getExistBeadDistribution', methods=['POST'])
def get_ExistBeadDistribution():
    cell_line = request.json['cell_line']
    indices = request.json['indices']
    return jsonify(exist_bead_distribution(cell_line, indices))


@api.route('/getExample3DProgress', methods=['GET'])
def get_Example3DProgress():
    cell_line       = request.args['cell_line']
    chromosome_name = request.args['chromosome_name']
    start           = request.args['start']
    end             = request.args['end']
    sample_id       = request.args['sample_id']
    is_exist        = request.args['is_exist']

    if is_exist == 'true':
        key = f"{cell_line}:chr8:127300000:128300000:exist_{sample_id}_progress"
        val = redis_client.get(key)
        return jsonify(percent=int(val) if val is not None else 0)
    else:
        key = f"{cell_line}:{chromosome_name}:{start}:{end}:{sample_id}_progress"
        val = redis_client.get(key)
        return jsonify(percent=int(val) if val is not None else 0)


@api.route('/getCeleryTaskProgress', methods=['GET'])
def get_celery_task_progress():
    """Get progress of a Celery task using task ID"""
    task_id = request.args.get('task_id')
    
    if not task_id:
        return jsonify(error="task_id parameter is required"), 400
    
    try:
        # Get task result using Celery's AsyncResult
        result = celery_worker.AsyncResult(task_id)
        
        if result.state == 'PENDING':
            response = {
                'state': result.state,
                'current': 0,
                'total': 100,
                'status': 'Task is waiting to be processed...'
            }
        elif result.state == 'PROGRESS':
            response = {
                'state': result.state,
                'current': result.info.get('current', 0),
                'total': result.info.get('total', 100),
                'status': result.info.get('status', 'Processing...')
            }
        elif result.state == 'SUCCESS':
            response = {
                'state': result.state,
                'current': 100,
                'total': 100,
                'status': 'Task completed successfully',
                'result': result.result
            }
        else:  # FAILURE or other states
            response = {
                'state': result.state,
                'current': 0,
                'total': 100,
                'status': str(result.info)
            }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify(error=f"Failed to get task progress: {str(e)}"), 500


@app.route('/api/clearFoldingInputFolderInputContent', methods=['POST'])
def clearFoldingInputFolderInputContent():
    folder = os.path.join(os.path.dirname(__file__), 'Folding_input')
    if os.path.exists(folder):
        shutil.rmtree(folder)
    os.makedirs(folder, exist_ok=True)
    return jsonify({'status': 'cleared'})


@api.route('/downloadFullChromosome3DDistanceData', methods=['POST'])
def downloadFullChromosome3DDistanceData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    is_example = request.json['is_example']
    file_path, npz_file = download_full_chromosome_3D_distance_data(cell_line, chromosome_name, sequences, is_example)

    if not is_example:
        @after_this_request
        def remove_file(response):
            try:
                os.remove(file_path)
                app.logger.info("Deleted temporary npz file: %s", file_path)
            except Exception as error:
                app.logger.error("Failed to delete npz file: %s", error)
            return response
    return npz_file


@api.route('/downloadFullChromosome3DPositionData', methods=['POST'])
def downloadFullChromosome3DPositionData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    is_example = request.json['is_example']
    file_path, csv_file = download_full_chromosome_3D_position_data(cell_line, chromosome_name, sequences, is_example)

    if not is_example:
        @after_this_request
        def remove_file(response):
            try:
                os.remove(file_path)
                app.logger.info("Deleted temporary csv file: %s", file_path)
            except Exception as error:
                app.logger.error("Failed to delete csv file: %s", error)
            return response
    return csv_file


app.register_blueprint(api)


@app.route('/')
def index():
    return 'Hello, World!'


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)
