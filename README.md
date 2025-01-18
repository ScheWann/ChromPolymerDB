# CS522 Project
A Web Server for High-Resolution Ensemble Models of 3D Single-Cell Chromatin Conformations

# INSTRUCTION
1. Install **Docker** to your laptop
2. Download the sample data from this [link](https://uofi.app.box.com/file/1699376802565?s=egh737w70px0iqcnhtq2re3xwbs1qh38) and create a **Example_Data** folder in under the root project directory
3. Create a .env file under the root project directory
```
    DB_USERNAME=admin
    DB_HOST=db
    DB_NAME=chromosome_db
    DB_PASSWORD=chromosome
    PGADMIN_DEFAULT_EMAIL=admin@uic.edu
    PGADMIN_DEFAULT_PASSWORD=chromosome
```
4. Under this project folder, and run ```docker compose up --build``` (it will need some time for the initialization)