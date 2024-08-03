package main

import (
	"crypto/rand"
	"os"
	"testing"
)

var (
	g_contentLength = 1000 * 1000 * 5
	g_content       string
)

func TestMain(m *testing.M) {
	// setup
	buffer := make([]byte, g_contentLength)
	rand.Read(buffer)
	g_content = string(buffer)
	// run
	code := m.Run()
	os.Exit(code)
}
func BenchmarkCharScanner(b *testing.B) {
	var (
		i  int
		ch byte
	)
	for i = 0; i < g_contentLength; i++ {
		ch = g_content[i]
		for ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' {
			break
		}
	}
}
