FROM python:3.13.0-bookworm

WORKDIR /chromosome/backend

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Install git
RUN apt-get update && apt-get install -y git cmake libzip-dev
WORKDIR /chromosome
RUN git clone https://github.com/ScheWann/sBIF.git

# Build sBIF
WORKDIR /chromosome/sBIF
ENV CXX=g++
RUN mkdir output
RUN cmake . && make

WORKDIR /chromosome/backend

COPY . .

RUN chmod +x ./process.py
RUN chmod +x ./sBIF.sh

EXPOSE 5001
CMD ["sh", "-c", "python app.py"]