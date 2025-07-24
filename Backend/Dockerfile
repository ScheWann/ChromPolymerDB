FROM python:3.13.0-bookworm

WORKDIR /chromosome/backend

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Install git, curl, and other dependencies
RUN apt-get update && apt-get install -y git cmake libzip-dev curl
WORKDIR /chromosome
RUN git clone https://github.com/ScheWann/sBIF.git

# Build sBIF
WORKDIR /chromosome/sBIF
ENV CXX=g++
RUN mkdir output
RUN cmake -DCMAKE_BUILD_TYPE=Release . && make -j$(nproc)

WORKDIR /chromosome/backend

COPY . .

RUN chmod +x ./process.py
RUN chmod +x ./sBIF.sh

EXPOSE 5001
CMD ["gunicorn", \
    "-w", "1", \
    "-b", "0.0.0.0:5001", \
    "--chdir", "/chromosome/backend", \
    "app:app"]