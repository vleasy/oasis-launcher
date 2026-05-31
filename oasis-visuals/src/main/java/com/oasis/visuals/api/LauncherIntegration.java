package com.oasis.visuals.api;

import com.google.gson.*;
import java.net.*;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;

public class LauncherIntegration {
    private static final String API_BASE = "http://localhost:3000/api";
    private final HttpClient http = HttpClient.newHttpClient();
    private final Gson gson = new Gson();
    private ScheduledExecutorService scheduler;
    private String lastFriendsJson;

    public void start() {
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(this::pollFriends, 0, 10, TimeUnit.SECONDS);
    }

    public void stop() {
        if (scheduler != null) scheduler.shutdown();
    }

    private void pollFriends() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(API_BASE + "/friends"))
                .timeout(Duration.ofSeconds(5))
                .GET().build();
            http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .thenAccept(res -> {
                    if (res.statusCode() == 200) lastFriendsJson = res.body();
                });
        } catch (Exception e) {
            // launcher API unreachable
        }
    }

    public String getFriendsJson() { return lastFriendsJson; }

    public CompletableFuture<String> checkUpdate() {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/builds/shared/oasis-visuals/version"))
            .timeout(Duration.ofSeconds(3))
            .GET().build();
        return http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> res.statusCode() == 200 ? res.body() : null);
    }
}
