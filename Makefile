CONTAINER_NAME?=$(shell grep CONTAINER_NAME .env.deploy | cut -d '=' -f2)
DOMAIN?=$(shell grep DOMAIN .env.deploy | cut -d '=' -f2)
EC2_INSTANCE?=$(shell grep EC2_INSTANCE .env.deploy | cut -d '=' -f2)
CLOUDFRONT_DISTRIBUTION_ID?=$(shell grep CLOUDFRONT_DISTRIBUTION_ID .env.deploy | cut -d '=' -f2)

# Test environment variables
test-env:
	@echo "Testing environment variables from .env.deploy file:"
	@if [ ! -f .env.deploy ]; then echo "ERROR: .env.deploy does not exist — copy .env.deploy.example and fill in values"; exit 1; fi
	@echo "CONTAINER_NAME              = $(CONTAINER_NAME)"
	@echo "DOMAIN                      = $(DOMAIN)"
	@echo "EC2_INSTANCE                = $(EC2_INSTANCE)"
	@echo "CLOUDFRONT_DISTRIBUTION_ID  = $(CLOUDFRONT_DISTRIBUTION_ID)"
	@if [ -z "$(CONTAINER_NAME)" ]; then echo "WARNING: CONTAINER_NAME is empty!"; fi
	@if [ -z "$(DOMAIN)" ]; then echo "WARNING: DOMAIN is empty!"; fi
	@if [ -z "$(EC2_INSTANCE)" ]; then echo "WARNING: EC2_INSTANCE is empty!"; fi
	@if [ -z "$(CLOUDFRONT_DISTRIBUTION_ID)" ]; then echo "WARNING: CLOUDFRONT_DISTRIBUTION_ID is empty!"; fi

# Build frontend
build-frontend:
	cd ui && npm install && npm run build

# Upload frontend to S3
deploy-frontend: build-frontend
	aws s3 sync ui/build/ s3://$(DOMAIN) --delete

# Add this new target
invalidate-cloudfront:
	aws cloudfront create-invalidation --distribution-id $(CLOUDFRONT_DISTRIBUTION_ID) --paths "/*"

# Setup Docker on EC2 instance
setup-ec2:
	@echo "Installing Docker on EC2 instance..."
	ssh -t -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'sudo apt update && \
	sudo apt install -y apt-transport-https ca-certificates curl software-properties-common && \
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add - && \
	sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $$(lsb_release -cs) stable" && \
	sudo apt update && \
	sudo apt install -y docker-ce && \
	sudo systemctl start docker && \
	sudo systemctl enable docker && \
	sudo usermod -aG docker ubuntu && \
	docker --version || echo "Please log out and log back in for group changes to take effect"'
	@echo "Docker installation completed. You may need to wait a moment for group changes to take effect."

# Clean up EC2 instance before deployment
cleanup-ec2:
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'docker system prune -a -f'

# deploy backend
deploy-backend: cleanup-ec2
	# Copy docker-compose.yml and .env to EC2
	scp -i ./vti-keypair.pem docker-compose.yml ubuntu@$(EC2_INSTANCE):~/docker-compose.yml
	scp -i ./vti-keypair.pem ./server/.env ubuntu@$(EC2_INSTANCE):~/server.env
	# Copy server folder (for context/build) to EC2
	rsync -avz -e "ssh -i ./vti-keypair.pem" ./server/ ubuntu@$(EC2_INSTANCE):~/server/
	# On EC2: build and start production containers
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'cd ~ && docker compose -f docker-compose.yml up --build -d backend-prod celery-worker-prod redis'

# Deploy everything
deploy-aws: deploy-frontend deploy-backend invalidate-cloudfront
	@echo "Deployed frontend to S3 and backend and invalidated CloudFront cache"

logs-app-prod:
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'docker compose exec backend-prod tail -f /app/app.log'

ssh-prod:
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE)

check-docker-errors:
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'sudo systemctl status docker --no-pager || true; sudo journalctl -u docker.service -n 200 --no-pager || true; echo "Exited containers:"; docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" || true; for c in `docker ps -a --filter "status=exited" -q`; do echo "=== logs for $$c ==="; docker logs --tail 200 $$c || true; done'

clear-logs:
	@echo "Clearing logs on EC2..."
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'cd ~/server && sudo rm -f app.log azure_openai_usage.log || true && sudo touch app.log azure_openai_usage.log && sudo chown ubuntu:ubuntu app.log azure_openai_usage.log && echo "Logs cleared"'

get-size-docker-logs:
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'LOGPATH="$$(sudo docker inspect --format="{{.LogPath}}" $(CONTAINER_NAME) 2>/dev/null)"; if [ -z "$$LOGPATH" ]; then echo "Container not found or cannot inspect logs"; exit 1; fi; sudo du -h "$$LOGPATH" | cut -f1'

clear-docker-logs:
	@echo "Clearing logs on EC2..."
	ssh -i ./vti-keypair.pem ubuntu@$(EC2_INSTANCE) 'LOGPATH="$$(sudo docker inspect --format="{{.LogPath}}" $(CONTAINER_NAME) 2>/dev/null)"; if [ -z "$$LOGPATH" ]; then echo "Container not found or cannot inspect logs"; exit 1; fi; sudo truncate -s 0 "$$LOGPATH" && echo "Logs cleared."'
