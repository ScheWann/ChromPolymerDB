# INSTRUCTION
1. Install **Docker** to your laptop

2. Prepare the **_data_** and create a **Data** folder under the root project directory.

3. Prepare the **_example data_** and create a **example_data** folder under the **Backend** directory.

4. Create a **.env** file under the root project directory
    ```dotenv
        DB_USERNAME=admin
        DB_HOST=db
        DB_NAME=chromosome_db
        DB_PASSWORD=chromosome
        PGADMIN_DEFAULT_EMAIL=admin@uic.edu
        PGADMIN_DEFAULT_PASSWORD=chromosome
    ```

5. Under this project folder, and run 
    ```bash
        docker compose up -d --build
    ```