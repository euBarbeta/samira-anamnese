package com.samira.estetica;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ✅ Força modo CLARO sempre, ignorando o modo escuro do sistema
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);

        super.onCreate(savedInstanceState);
        criarCanalNotificacao();
    }

    private void criarCanalNotificacao() {
        NotificationChannelCompat channel = new NotificationChannelCompat
                .Builder("lembretes", NotificationManagerCompat.IMPORTANCE_HIGH)
                .setName("Lembretes")
                .setDescription("Notificações de lembretes da Samira Estética")
                .build();

        NotificationManagerCompat manager = NotificationManagerCompat.from(this);
        manager.createNotificationChannel(channel);
    }
}