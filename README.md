# INSTRUCTION
1. Install **Docker** to your laptop
2. Download the data from this [link](https://uofi.box.com/s/q95qrw1bo68pvklb7i3ung6bmvnzpwjx) and create a **Data** folder under the root project directory.
3. Download the example data from this [link](https://uofi.box.com/s/9jberg5gxm9p07oo0daro9l57emzpn9t) and create a **example_data** folder under the **Backend** directory.
3. Create a **.env** file under the root project directory
```
    DB_USERNAME=admin
    DB_HOST=db
    DB_NAME=chromosome_db
    DB_PASSWORD=chromosome
    PGADMIN_DEFAULT_EMAIL=admin@uic.edu
    PGADMIN_DEFAULT_PASSWORD=chromosome
```
4. Under this project folder, and run ```docker compose up --build``` (it will need some time for the initialization)