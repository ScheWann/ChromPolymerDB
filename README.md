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
    DB_PORT=5432
    PGADMIN_DEFAULT_EMAIL=admin@uic.edu
    PGADMIN_DEFAULT_PASSWORD=chromosome
    ```

5. For development, under this project folder, and run 
    ```bash
    docker compose up -d --build
    ```

# DEPLOY
1. Switch to **publish** branch
    ```
    git switch publish
    ```
2. Build
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

# Troubleshooting

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
```

### Database Issues
```bash
# Check database connection
docker compose exec db psql -U $DB_USERNAME -d $DB_NAME
```

### Clean Redis
```bash
docker exec -it Redis redis-cli FLUSHALL
```

### Clean the Docker Build Cache
```bash
docker builder prune --all
```

### Container Operation
```bash
docker exec -it <container ID> bash
```

### Download distance data from the database
Take GM12878-chr8-127300000-128300000 as an example
```bash
psql -U admin -d chromosome_db \
  --command "\copy (SELECT * FROM public.distance WHERE cell_line = 'GM12878' AND chrid = 'chr8' AND start_value = 127300000 AND end_value = 128300000) TO '/opt/GM12878_chr8_127300000_128300000_original_distance.csv' WITH (FORMAT csv, HEADER, DELIMITER ',', QUOTE '\"', ESCAPE '''');"
```
