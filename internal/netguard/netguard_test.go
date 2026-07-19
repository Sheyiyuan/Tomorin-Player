package netguard

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"testing"
)

type staticResolver map[string][]net.IPAddr

func (r staticResolver) LookupIPAddr(_ context.Context, host string) ([]net.IPAddr, error) {
	addresses, ok := r[host]
	if !ok {
		return nil, fmt.Errorf("unknown host %s", host)
	}
	return addresses, nil
}

func TestPublicGatewayRejectsPrivateDNSResult(t *testing.T) {
	dialed := false
	client := NewPublicGateway(Config{
		Resolver: staticResolver{"private.example": {{IP: net.ParseIP("127.0.0.1")}}},
		DialContext: func(context.Context, string, string) (net.Conn, error) {
			dialed = true
			return nil, fmt.Errorf("unexpected dial")
		},
	})

	_, err := client.Get("http://private.example/image.png")
	if err == nil || !strings.Contains(err.Error(), "non-public") {
		t.Fatalf("expected non-public target error, got %v", err)
	}
	if dialed {
		t.Fatal("private target reached dialer")
	}
}

func TestPublicGatewayPinsResolvedAddress(t *testing.T) {
	var dialedAddress string
	client := NewPublicGateway(Config{
		Resolver: staticResolver{"public.example": {{IP: net.ParseIP("8.8.8.8")}}},
		DialContext: func(_ context.Context, _, address string) (net.Conn, error) {
			dialedAddress = address
			clientConn, serverConn := net.Pipe()
			go func() {
				defer serverConn.Close()
				buffer := make([]byte, 4096)
				_, _ = serverConn.Read(buffer)
				_, _ = io.WriteString(serverConn, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
			}()
			return clientConn, nil
		},
	})

	resp, err := client.Get("http://public.example/file")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	_ = resp.Body.Close()
	if dialedAddress != "8.8.8.8:80" {
		t.Fatalf("dialed %q, want pinned public IP", dialedAddress)
	}
}

func TestPublicGatewayRejectsPrivateRedirect(t *testing.T) {
	var mu sync.Mutex
	dials := 0
	client := NewPublicGateway(Config{
		Resolver: staticResolver{"public.example": {{IP: net.ParseIP("8.8.8.8")}}},
		DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
			mu.Lock()
			dials++
			mu.Unlock()
			clientConn, serverConn := net.Pipe()
			go func() {
				defer serverConn.Close()
				buffer := make([]byte, 4096)
				_, _ = serverConn.Read(buffer)
				_, _ = io.WriteString(serverConn, "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/secret\r\nContent-Length: 0\r\n\r\n")
			}()
			return clientConn, nil
		},
	})

	resp, err := client.Get("http://public.example/redirect")
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}
	if err == nil || !strings.Contains(err.Error(), "redirect target rejected") {
		t.Fatalf("expected redirect rejection, got %v", err)
	}
	mu.Lock()
	defer mu.Unlock()
	if dials != 1 {
		t.Fatalf("got %d dials, private redirect should not be dialed", dials)
	}
}

func TestAllowedHostSuffixes(t *testing.T) {
	for _, host := range []string{"bilivideo.com", "audio.bilivideo.com"} {
		if err := validateAllowedHost(host, []string{"bilivideo.com"}); err != nil {
			t.Fatalf("allowed host %q rejected: %v", host, err)
		}
	}
	for _, host := range []string{"evilbilivideo.com", "bilivideo.com.example.org"} {
		if err := validateAllowedHost(host, []string{"bilivideo.com"}); err == nil {
			t.Fatalf("disallowed host %q accepted", host)
		}
	}
}

func TestValidatePublicURLRejectsCredentialsAndSpecialAddresses(t *testing.T) {
	tests := []string{
		"http://user:password@example.com/image",
		"http://[::1]/image",
		"http://169.254.169.254/latest/meta-data",
		"http://198.51.100.1/image",
	}
	for _, raw := range tests {
		req, err := http.NewRequest(http.MethodGet, raw, nil)
		if err != nil {
			t.Fatalf("build request: %v", err)
		}
		if err := ValidatePublicURL(req.URL); err == nil {
			t.Errorf("expected %s to be rejected", raw)
		}
	}
}
