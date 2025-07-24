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
    docker-compose -f docker-compose.prod.yml up -d --build
    ```

# Troubleshooting

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Issues
```bash
# Check database connection
docker-compose -f docker-compose.prod.yml exec db psql -U $DB_USERNAME -d $DB_NAME
```

### API Connection Issues
If frontend and backend are not connecting:

```bash
# Check if backend is responding
curl http://localhost:5001/

# Check backend logs for errors
docker-compose -f docker-compose.prod.yml logs -f backend

# Check frontend proxy logs
docker-compose -f docker-compose.prod.yml logs -f frontend

# Test API endpoint directly
curl http://localhost:5001/api/getCellLines
```