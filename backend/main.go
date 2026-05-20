package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/linkhub/backend/internal/cache"
	"github.com/linkhub/backend/internal/db"
	"github.com/linkhub/backend/internal/handlers"
	authmw "github.com/linkhub/backend/internal/middleware"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using environment variables")
	}

	pool, err := db.Connect(context.Background())
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	redisClient, err := cache.NewClient()
	if err != nil {
		log.Fatalf("redis connection failed: %v", err)
	}
	defer redisClient.Close()

	e := echo.New()
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodOptions},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}))
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	urlHandler := handlers.NewURLHandler(pool, redisClient)
	authHandler := handlers.NewAuthHandler(pool)

	jwtMW := authmw.JWT(os.Getenv("JWT_SECRET"))

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Root-level short URL redirect: http://localhost:8080/<code>
	e.GET("/:code", urlHandler.Redirect)

	api := e.Group("/api/v1")

	// Auth endpoints — no JWT required
	auth := api.Group("/auth")
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
	auth.POST("/refresh", authHandler.Refresh)
	auth.POST("/logout", authHandler.Logout)

	// Public URL endpoints
	api.GET("/:code", urlHandler.Redirect)
	// Protected URL endpoints — JWT required
	protected := api.Group("", jwtMW)
	protected.POST("/shorten", urlHandler.Shorten)
	protected.GET("/urls", urlHandler.ListUserURLs)
	protected.GET("/urls/top", urlHandler.TopURLs)
	protected.GET("/:code/stats", urlHandler.GetStats)
	protected.PATCH("/:code/deactivate", urlHandler.Deactivate)
	protected.PATCH("/:code/activate", urlHandler.Activate)

	e.Logger.Fatal(e.Start(":8080"))
}
