import os
import orjson
import shutil
import redis
from flask import Flask, jsonify, request, after_this_request, Response, Blueprint, make_response
from flask_cors import CORS
import uuid
from process import (
    gene_names_list, 
    cell_lines_list, 
    chromosome_size, 
    chromosomes_list,
    chromosome_original_valid_sequences, 
    chromosome_merged_valid_sequences, 
    chromosome_data, 
    chromosome_3D_data, 
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
    exist_chromosome_3D_data,
    bead_distribution_pvalues
)


app = Flask(__name__)
CORS(app)

# Cookie configuration
USER_ID_COOKIE = 'chrom_polymer_user_id'
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def get_or_create_user_id():
   """Get user ID from cookie or create a new one"""
   user_id = request.cookies.get(USER_ID_COOKIE)
   if not user_id:
       user_id = str(uuid.uuid4())
   return user_id


def set_user_cookie(response, user_id):
   """Set user ID cookie on response"""
   response.set_cookie(
       USER_ID_COOKIE,
       user_id,
       max_age=COOKIE_MAX_AGE,
       httponly=True,
       secure=True,  # Set to True in production with HTTPS
       samesite='Lax'
   )
   return response


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
    sequences = request.json['sequences']
    chromosome_name = request.json.get('chromosome_name', 'chr8')  # Default to chr8 for backward compatibility
    payload = orjson.dumps(exist_chromosome_3D_data(cell_line, sample_id, sequences, chromosome_name))
    return Response(payload, content_type='application/json')


@api.route('/getChromosome3DData', methods=['POST'])
def get_Chromosome3DData():
    cell_line = request.json['cell_line']
    chromosome_name = request.json['chromosome_name']
    sequences = request.json['sequences']
    sample_id = request.json['sample_id']
    return jsonify(chromosome_3D_data(cell_line, chromosome_name, sequences, sample_id))


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
    chromosome_name = request.json.get('chromosome_name', 'chr8')  # Default to chr8 for backward compatibility
    sequences = request.json.get('sequences', {"start": 127300000, "end": 128300000})  # Default for backward compatibility
    return jsonify(exist_bead_distribution(cell_line, indices, chromosome_name, sequences))


@api.route('/getBeadDistributionPValues', methods=['POST'])
def get_BeadDistributionPValues():
    groups = request.json
    return jsonify(bead_distribution_pvalues(groups))


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


@api.route('/getTourStatus', methods=['GET'])
def get_tour_status():
   """Get whether the user has seen the tour before"""
   user_id = get_or_create_user_id()
  
   # Check if user has seen tour before (stored in Redis)
   tour_seen = redis_client.get(f"tour_seen:{user_id}")
  
   response_data = {
       'tour_seen': tour_seen is not None and tour_seen.decode() == 'true',
       'user_id': user_id,
       'is_new_user': tour_seen is None  # True if this is the first time we see this user
   }
  
   response = make_response(jsonify(response_data))
   response = set_user_cookie(response, user_id)
  
   return response




@api.route('/setTourSeen', methods=['POST'])
def set_tour_seen():
   """Mark the tour as seen for this user (first time only)"""
   user_id = get_or_create_user_id()
  
   # Store tour seen status in Redis (expires in 1 year)
   # This gets set the moment the tour is shown, not when completed
   redis_client.setex(f"tour_seen:{user_id}", 60 * 60 * 24 * 365, 'true')
  
   response = make_response(jsonify({'status': 'success', 'user_id': user_id}))
   response = set_user_cookie(response, user_id)
  
   return response

app.register_blueprint(api)


@app.route('/')
def index():
    return 'Hello, World!'


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)
