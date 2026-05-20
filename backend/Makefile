.PHONY: run build clean tidy migrate

run:
	go run main.go

build:
	go build -o bin/linkhub main.go

clean:
	rm -rf bin/

tidy:
	go mod tidy

migrate:
	psql "$$DATABASE_URL" -f migrations/001_create_urls.sql
